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
            // Check Pending txs + recently-Failed txs (within last 24h) so mis-classified
            // transactions get a second look on the next cycle.
            const recentFailedCutoff = new Date(Date.now() - 24 * 60 * 60 * 1_000);
            const txsToCheck = await (prisma.transaction as any).findMany({
                where: {
                    OR: [
                        { status: 'Pending' },
                        { status: 'Failed', updatedAt: { gte: recentFailedCutoff } },
                    ],
                },
                take: 100,
                select: { id: true, txid: true, network: true, createdAt: true, status: true },
            });

            if (txsToCheck.length === 0) return;

            const pending = txsToCheck.filter((t: any) => t.status === 'Pending').length;
            const recheck = txsToCheck.filter((t: any) => t.status === 'Failed').length;
            console.log(`[StatusSync] Checking ${pending} pending + ${recheck} recently-failed transactions...`);

            // Process all in parallel — each tx picks its own network endpoint
            await Promise.allSettled(
                txsToCheck.map((tx: any) =>
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
     *   1. tx_status === 'success'                          → Confirmed
     *   2. tx_result.repr starts with '(ok '               → Confirmed
     *      (handles edge cases where the sponsor wrapper post-condition
     *       is flagged but the inner contract call actually succeeded)
     *   3. tx_status is a hard abort/drop AND tx_result is (err ...) → Failed
     *   4. Chain returns 404 + tx < 2h                     → still Pending
     *   5. Chain returns 404 + tx ≥ 2h                     → Failed (dropped)
     *   6. Any other API error                             → leave Pending, log warning
     *
     * NOTE: We intentionally do NOT mark a tx Failed based solely on
     * tx_status abort codes. We always cross-check tx_result.repr so that
     * a post-condition abort on the sponsor wrapper never hides a successful
     * inner execution.
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
            // tx_result.repr is the canonical execution result from the Clarity VM.
            // It starts with '(ok ...)' on success and '(err ...)' on failure,
            // regardless of what the outer tx_status says.
            const resultRepr: string = data.tx_result?.repr ?? '';

            let newStatus: string | null = null;

            if (chainStatus === 'success') {
                // Unambiguous on-chain success
                newStatus = 'Confirmed';
            } else if (resultRepr.startsWith('(ok ')) {
                // tx_result says the contract call returned ok — treat as Confirmed
                // even if tx_status shows an abort code on the sponsor wrapper layer
                console.log(`[StatusSync] ${network} TX ${txid}: tx_status=${chainStatus} but tx_result=${resultRepr} — marking Confirmed`);
                newStatus = 'Confirmed';
            } else if (
                (chainStatus === 'abort_by_post_condition' ||
                 chainStatus === 'abort_by_response'       ||
                 chainStatus === 'abort_by_mempool'        ||
                 chainStatus.startsWith('dropped_'))
                && !resultRepr.startsWith('(ok ')
            ) {
                // Hard failure confirmed by both status and result
                newStatus = 'Failed';
            }
            // 'pending' or anything else → leave as-is

            if (newStatus) {
                console.log(`[StatusSync] ${network} TX ${txid}: ${chainStatus} (result: ${resultRepr || 'n/a'}) → ${newStatus}`);
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
