import { PrismaClient } from '@prisma/client';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';
import { invalidateStatsCache } from './services/RedisClient.js';

const prisma = new PrismaClient();

/**
 * StatusSyncService - Background poller for Stacks transaction status
 * This service ensures that transactions broadcasted as 'Pending' are 
 * updated to 'Success', 'Failed', or 'Dropped' once processed by the blockchain.
 */
export class StatusSyncService {
    private syncIntervalMs: number = 30000; // 30 seconds
    private networkType: 'mainnet' | 'testnet';
    private baseUrl: string;
    private timer: any = null;

    constructor() {
        this.networkType = (process.env.NETWORK || 'mainnet') as 'mainnet' | 'testnet';
        const network = this.networkType === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
        this.baseUrl = network.client.baseUrl;
    }

    /**
     * Start the synchronization service
     */
    public start() {
        if (this.timer) return;
        console.log(`[StatusSync] Starting Sync Service (${this.networkType}, ${this.syncIntervalMs}ms)`);
        this.timer = setInterval(() => this.sync(), this.syncIntervalMs);
        this.sync(); // Initial run
    }

    /**
     * Stop the synchronization service
     */
    public stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /**
     * Perform a single synchronization pass
     */
    private async sync() {
        try {
            const pendingTxs = await (prisma.transaction as any).findMany({
                where: { status: 'Pending' },
                take: 50
            });

            if (pendingTxs.length === 0) return;
            console.log(`[StatusSync] Checking ${pendingTxs.length} pending transactions...`);

            // Check every pending tx against the chain — never skip based on age alone.
            // A tx that is old but confirmed on-chain must be marked Confirmed, not Failed.
            for (const tx of pendingTxs) {
                await this.checkStatus(tx.id, tx.txid, new Date(tx.createdAt));
            }
        } catch (error) {
            console.error('[StatusSync] Sync Pass Failed:', error);
        }
    }

    /**
     * Check the status of a specific Stacks transaction against the chain.
     * Only falls back to Failed if the tx is >2h old AND still not found on-chain
     * (i.e. it was silently dropped from the mempool before broadcasting).
     */
    private async checkStatus(id: string, txid: string, createdAt: Date) {
        try {
            const url = `${this.baseUrl}/extended/v1/tx/${txid}`;
            const response = await fetch(url, { signal: AbortSignal.timeout(8000) });

            if (!response.ok) {
                if (response.status === 404) {
                    // Not on-chain yet. If it's been >2h it was silently dropped — mark Failed.
                    // Otherwise leave it Pending and check again next cycle.
                    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
                    if (createdAt < twoHoursAgo) {
                        console.log(`[StatusSync] TX ${txid} not found after 2h — marking Failed`);
                        const updated = await (prisma.transaction as any).update({
                            where: { id },
                            data: { status: 'Failed' }
                        });
                        if (updated?.userId) await invalidateStatsCache(updated.userId);
                    }
                    return;
                }
                console.warn(`[StatusSync] API error for ${txid}: ${response.status}`);
                return;
            }

            const data: any = await response.json();
            const blockchainStatus = data.tx_status;

            // Map blockchain status → dashboard status
            let newStatus = 'Pending';
            if (blockchainStatus === 'success') {
                newStatus = 'Confirmed';
            } else if (
                blockchainStatus === 'abort_by_post_condition' ||
                blockchainStatus === 'abort_by_response' ||
                blockchainStatus === 'abort_by_mempool' ||
                blockchainStatus === 'dropped_replace_by_fee' ||
                blockchainStatus === 'dropped_replace_across_fork' ||
                blockchainStatus === 'dropped_too_expensive' ||
                blockchainStatus === 'dropped_stale_garbage_collect' ||
                blockchainStatus === 'dropped_problematic'
            ) {
                newStatus = 'Failed';
            }

            if (newStatus !== 'Pending') {
                console.log(`[StatusSync] Updating TX ${txid}: ${newStatus}`);
                const updated = await (prisma.transaction as any).update({
                    where: { id },
                    data: { status: newStatus }
                });
                if (updated?.userId) await invalidateStatsCache(updated.userId);
            }
        } catch (error) {
            console.error(`[StatusSync] Failed to check status for ${txid}:`, error);
        }
    }
}
