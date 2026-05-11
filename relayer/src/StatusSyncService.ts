import { PrismaClient } from '@prisma/client';
import { invalidateStatsCache } from './services/RedisClient.js';

const prisma = new PrismaClient();

// Hiro API base URLs — one per network
const HIRO_BASE: Record<'mainnet' | 'testnet', string> = {
    mainnet: 'https://api.mainnet.hiro.so',
    testnet: 'https://api.testnet.hiro.so',
};

/**
 * StatusSyncService — polls pending transactions on both mainnet and testnet
 * and updates their status based on the actual on-chain result.
 *
 * Each transaction row carries a `network` column ('mainnet' | 'testnet').
 * The correct Hiro endpoint is chosen per-transaction, so a single relayer
 * instance handles both networks correctly.
 */
export class StatusSyncService {
    private syncIntervalMs = 30_000; // 30 seconds
    private timer: ReturnType<typeof setInterval> | null = null;

    public start() {
        if (this.timer) return;
        console.log('[StatusSync] Starting — polling mainnet + testnet every 30s');
        this.timer = setInterval(() => this.sync(), this.syncIntervalMs);
        this.sync(); // immediate first pass
    }

    public stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    private async sync() {
        try {
            const pendingTxs = await (prisma.transaction as any).findMany({
                where: { status: 'Pending' },
                take: 100,
                select: { id: true, txid: true, network: true, createdAt: true },
            });

            if (pendingTxs.length === 0) return;
            console.log(`[StatusSync] Checking ${pendingTxs.length} pending transactions...`);

            // Process all in parallel — each tx picks its own network endpoint
            await Promise.allSettled(
                pendingTxs.map((tx: any) =>
                    this.checkStatus(tx.id, tx.txid, tx.network || 'mainnet', new Date(tx.createdAt))
                )
            );
        } catch (error) {
            console.error('[StatusSync] Sync pass failed:', error);
        }
    }

    /**
     * Check a single transaction against the correct network's Hiro API.
     *
     * Resolution order:
     *   1. Chain says success            → Confirmed
     *   2. Chain says abort/dropped      → Failed
     *   3. Chain returns 404 + tx < 2h  → still Pending (check next cycle)
     *   4. Chain returns 404 + tx ≥ 2h  → Failed (silently dropped from mempool)
     *   5. Any other API error           → leave Pending, log warning
     */
    private async checkStatus(
        id: string,
        txid: string,
        network: 'mainnet' | 'testnet',
        createdAt: Date,
    ) {
        const baseUrl = HIRO_BASE[network] ?? HIRO_BASE.mainnet;

        try {
            const res = await fetch(`${baseUrl}/extended/v1/tx/${txid}`, {
                signal: AbortSignal.timeout(8_000),
            });

            if (!res.ok) {
                if (res.status === 404) {
                    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1_000);
                    if (createdAt < twoHoursAgo) {
                        console.log(`[StatusSync] ${network} TX ${txid} not found after 2h — marking Failed`);
                        await this.updateStatus(id, 'Failed');
                    }
                    // else: still young, leave Pending
                } else {
                    console.warn(`[StatusSync] ${network} API error for ${txid}: ${res.status}`);
                }
                return;
            }

            const data: any = await res.json();
            const chainStatus: string = data.tx_status ?? '';

            let newStatus: string | null = null;

            if (chainStatus === 'success') {
                newStatus = 'Confirmed';
            } else if (
                chainStatus === 'abort_by_post_condition' ||
                chainStatus === 'abort_by_response'       ||
                chainStatus === 'abort_by_mempool'        ||
                chainStatus.startsWith('dropped_')
            ) {
                newStatus = 'Failed';
            }
            // 'pending' or anything else → leave as-is

            if (newStatus) {
                console.log(`[StatusSync] ${network} TX ${txid}: ${chainStatus} → ${newStatus}`);
                await this.updateStatus(id, newStatus);
            }
        } catch (error) {
            console.error(`[StatusSync] Failed to check ${network} TX ${txid}:`, error);
        }
    }

    private async updateStatus(id: string, status: string) {
        try {
            const updated = await (prisma.transaction as any).update({
                where: { id },
                data: { status },
            });
            if (updated?.userId) {
                await invalidateStatsCache(updated.userId).catch(() => {});
            }
        } catch (err) {
            console.error(`[StatusSync] DB update failed for id=${id}:`, err);
        }
    }
}
