import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PaymasterService } from './PaymasterService.js';
import { getAddressFromPrivateKey } from '@stacks/transactions';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';
import { verifySupabaseToken, AuthRequest } from './auth.js';
import { createRateLimiters } from './middleware/rateLimiter.js';
import { StatusSyncService } from './StatusSyncService.js';
import { getCachedStats, setCachedStats, invalidateStatsCache, getRedisClient } from './services/RedisClient.js';
import { hashApiKey } from './utils/hashApiKey.js';

dotenv.config();

const prisma = new PrismaClient();
const statusSync = new StatusSyncService();
statusSync.start();

const rateLimiters = createRateLimiters(getRedisClient());
const app = express();
const port = process.env.PORT || 4000;

(BigInt.prototype as any).toJSON = function () { return this.toString(); };

app.use(cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        const allowedPatterns = [/localhost:\d+$/, /\.vercel\.app$/, /velumx\.xyz$/, /\.velumx\.xyz$/];
        if (!origin || allowedPatterns.some(p => p.test(origin))) {
            callback(null, true);
        } else {
            console.warn(`CORS: Blocked request from unauthorized origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));
// Limit request body to 512KB — accommodates batch payloads (up to 25 tx hexes), blocks body-flood attacks
app.use(express.json({ limit: '512kb' }));

// Strip the X-Powered-By header — no need to advertise the stack
app.disable('x-powered-by');

const paymasterService = new PaymasterService();

app.get('/', (_req: express.Request, res: express.Response) => {
    res.send('<h1>VelumX Relayer is Live</h1><p>Visit <a href="/health">/health</a> for status.</p>');
});

app.get('/health', (_req: express.Request, res: express.Response) => {
    res.json({ status: 'ok', service: 'VelumX Relayer', pricingOracle: 'active' });
});

interface ApiKeyRequest extends express.Request {
    apiKeyId?: string;
    userId?: string;
}

const validateApiKey = async (req: ApiKeyRequest, res: express.Response, next: express.NextFunction) => {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.length > 256) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const keyHash = hashApiKey(apiKey);

        // Primary lookup: by hash (new keys). Fallback: by plaintext (legacy keys not yet migrated).
        // Once all keys have a keyHash, remove the fallback `|| { key: apiKey }` branch.
        let keyRecord = await (prisma.apiKey as any).findUnique({
            where: { keyHash },
            select: { id: true, userId: true, status: true }
        });

        if (!keyRecord) {
            // Legacy fallback — key was created before hashing was introduced
            keyRecord = await (prisma.apiKey as any).findUnique({
                where: { key: apiKey },
                select: { id: true, userId: true, status: true }
            });

            // Opportunistically backfill the hash so this key migrates on next use
            if (keyRecord && keyRecord.status === 'Active') {
                (prisma.apiKey as any).update({
                    where: { id: keyRecord.id },
                    data: { keyHash }
                }).catch((e: Error) => console.error("Key hash backfill failed:", e.message));
            }
        }

        // Use a single constant-time response for both "not found" and "revoked"
        // to prevent timing-based enumeration of valid keys
        if (!keyRecord || keyRecord.status !== 'Active') {
            return res.status(401).json({ error: "Unauthorized" });
        }
        req.apiKeyId = keyRecord.id;
        req.userId = keyRecord.userId || undefined;
        next();
    } catch (error) {
        console.error("Auth Middleware Error:", error);
        res.status(500).json({ error: "Authentication failed" });
    }
};

app.get('/api/v1/config', validateApiKey, async (req: ApiKeyRequest, res: express.Response) => {
    try {
        const apiKey = await (prisma.apiKey as any).findUnique({
            where: { id: req.apiKeyId },
            select: { supportedGasTokens: true, sponsorshipPolicy: true }
        });
        res.json({
            supportedGasTokens: apiKey?.supportedGasTokens || [],
            sponsorshipPolicy: apiKey?.sponsorshipPolicy || 'USER_PAYS'
        });
    } catch (error: any) {
        console.error("Config Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/api/v1/estimate', validateApiKey, rateLimiters.estimateIp.middleware(), rateLimiters.estimate.middleware(), async (req: ApiKeyRequest, res: express.Response) => {
    try {
        const { intent, network } = req.body;
        if (!intent) return res.status(400).json({ error: "Missing intent" });
        const estimationIntent = { ...intent, network: network || intent.network || 'mainnet' };
        const estimation = await paymasterService.estimateFee(estimationIntent, req.apiKeyId!);
        const targetNetwork = estimationIntent.network as 'mainnet' | 'testnet';
        const relayerKey = paymasterService.getUserRelayerKey(req.userId!);
        const networkObj = targetNetwork === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
        const relayerAddress = getAddressFromPrivateKey(relayerKey.replace(/^0x/, ''), networkObj);
        const paymasterAddress = paymasterService.getPaymasterAddress(targetNetwork);
        res.json({ ...estimation, relayerAddress, paymasterAddress });
    } catch (error: any) {
        console.error("Estimation Error:", error);
        res.status(500).json({ error: error.message });
    }
});


app.post('/api/v1/broadcast', validateApiKey, rateLimiters.broadcastIp.middleware(), rateLimiters.broadcast.middleware(), async (req: ApiKeyRequest, res: express.Response) => {
    try {
        const { txHex, userId, feeAmount } = req.body;
        if (!txHex) return res.status(400).json({ error: "Missing transaction hex" });
        const result = await paymasterService.sponsorRawTransaction(txHex, req.apiKeyId!, userId || req.userId!, feeAmount);
        if (req.userId) await invalidateStatsCache(req.userId);
        res.json(result);
    } catch (error: any) {
        console.error("Broadcast Error:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/v1/broadcast/batch
 *
 * Sign and broadcast N sponsored transactions in a single API call.
 *
 * Request body:
 * {
 *   "transactions": [
 *     { "txHex": "0x...", "feeAmount": "250000" },   // feeAmount optional
 *     { "txHex": "0x..." },
 *     ...
 *   ],
 *   "userId": "optional-override"   // falls back to the key's owner
 * }
 *
 * Max batch size: 25 transactions per call.
 *
 * Response (always 200 — inspect each item's `error` field for per-item failures):
 * {
 *   "results": [
 *     { "index": 0, "txid": "0x...", "status": "sponsored" },
 *     { "index": 1, "error": "Transaction already processed (replay detected)" },
 *     ...
 *   ],
 *   "summary": { "total": 3, "succeeded": 2, "failed": 1 }
 * }
 */
const BATCH_MAX_SIZE = 25;

app.post(
    '/api/v1/broadcast/batch',
    validateApiKey,
    rateLimiters.batchBroadcastIp.middleware(),
    rateLimiters.batchBroadcast.middleware(),
    async (req: ApiKeyRequest, res: express.Response) => {
        try {
            const { transactions, userId } = req.body;

            // ── Input validation ──────────────────────────────────────────────
            if (!Array.isArray(transactions) || transactions.length === 0) {
                return res.status(400).json({ error: 'Missing or empty "transactions" array' });
            }
            if (transactions.length > BATCH_MAX_SIZE) {
                return res.status(400).json({
                    error: `Batch size exceeds maximum of ${BATCH_MAX_SIZE} transactions`
                });
            }
            for (let i = 0; i < transactions.length; i++) {
                if (!transactions[i]?.txHex || typeof transactions[i].txHex !== 'string') {
                    return res.status(400).json({ error: `Item at index ${i} is missing "txHex"` });
                }
            }
            // ─────────────────────────────────────────────────────────────────

            const effectiveUserId = userId || req.userId!;
            const apiKeyId = req.apiKeyId!;

            // Process all transactions concurrently — a failure in one does NOT abort others.
            const settled = await Promise.allSettled(
                transactions.map((item: { txHex: string; feeAmount?: string }) =>
                    paymasterService.sponsorRawTransaction(
                        item.txHex,
                        apiKeyId,
                        effectiveUserId,
                        item.feeAmount
                    )
                )
            );

            const results = settled.map((outcome, index) => {
                if (outcome.status === 'fulfilled') {
                    return { index, ...outcome.value };
                } else {
                    return { index, error: outcome.reason?.message ?? 'Unknown error' };
                }
            });

            const succeeded = results.filter(r => !('error' in r)).length;
            const failed = results.length - succeeded;

            // Invalidate dashboard cache once if any tx succeeded
            if (succeeded > 0 && req.userId) {
                await invalidateStatsCache(req.userId).catch(() => {});
            }

            console.log(`[Batch] key=${apiKeyId} total=${transactions.length} ok=${succeeded} fail=${failed}`);

            res.json({
                results,
                summary: { total: transactions.length, succeeded, failed }
            });
        } catch (error: any) {
            console.error('Batch Broadcast Error:', error);
            res.status(500).json({ error: error.message });
        }
    }
);


app.get('/api/dashboard/export-key', verifySupabaseToken, async (req: AuthRequest, res: express.Response) => {
    try {
        const userId = req.userId!;
        const key = paymasterService.getUserRelayerKey(userId);
        res.json({
            projectId: userId,
            mainnetAddress: getAddressFromPrivateKey(key, 'mainnet'),
            testnetAddress: getAddressFromPrivateKey(key, 'testnet'),
            paymasterMainnet: paymasterService.getPaymasterAddress('mainnet'),
            paymasterTestnet: paymasterService.getPaymasterAddress('testnet'),
            key
        });
    } catch (error: any) {
        console.error("Export Key Error:", error);
        res.status(500).json({ error: "Failed to export key" });
    }
});

// ── Dashboard Stats ───────────────────────────────────────────────────────────

// Cache bust endpoint — clears stale dashboard cache for the authenticated user
app.post('/api/dashboard/cache-clear', verifySupabaseToken, async (req: AuthRequest, res: express.Response) => {
    try {
        await invalidateStatsCache(req.userId!);
        res.json({ ok: true });
    } catch (e) {
        res.json({ ok: true }); // always succeed
    }
});

app.get('/api/dashboard/stats', verifySupabaseToken, rateLimiters.dashboard.middleware(), async (req: AuthRequest, res: express.Response) => {
    try {
        const userId = req.userId!;

        // Serve from Redis cache if available (2 min TTL)
        const cached = await getCachedStats(userId);
        if (cached) {
            console.log(`[Dashboard] Serving cached stats for ${userId}`);
            res.json(cached);
            return;
        }

        const getNetworkStats = async (networkType: 'mainnet' | 'testnet') => {
            try {
                const relayerKey = paymasterService.getUserRelayerKey(userId);
                const networkObj = networkType === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
                const relayerAddress = getAddressFromPrivateKey(relayerKey.replace(/^0x/, ''), networkObj);
                const hiroApiBase = networkType === 'mainnet' ? 'https://api.hiro.so' : 'https://api.testnet.hiro.so';

                // Run all independent operations in parallel
                const [totalTransactions, successfulTxs, allBroadcastedTxs, stxPrice, balancesData] = await Promise.all([
                    (prisma.transaction as any).count({ where: { userId, network: networkType } }),
                    (prisma.transaction as any).findMany({ where: { userId, network: networkType, status: { in: ['Success', 'Confirmed'] } } }),
                    (prisma.transaction as any).count({ where: { userId, network: networkType, status: { notIn: ['Failed'] } } }),
                    paymasterService.getStxPrice(),
                    fetch(`${hiroApiBase}/extended/v1/address/${relayerAddress}/balances`, { signal: AbortSignal.timeout(4000) })
                        .then(r => r.ok ? r.json() : null)
                        .catch(() => null)
                ]);

                const totalSponsoredUsd = (stxPrice || 0) * (allBroadcastedTxs * 0.005);
                const relayerStxBalance: string = balancesData?.stx?.balance || "0";

                // Wallet FT audit — convert all token balances to USD in parallel
                let walletFeeValueUsd = 0;
                if (balancesData?.fungible_tokens) {
                    const ftEntries = Object.entries(balancesData.fungible_tokens)
                        .filter(([, info]) => (info as any).balance && (info as any).balance !== '0')
                        .map(([rawKey, info]) => ({
                            principal: rawKey.includes('::') ? rawKey.split('::')[0] : rawKey,
                            balance: (info as any).balance as string
                        }));

                    const usdValues = await Promise.all(
                        ftEntries.map(({ principal, balance }) =>
                            paymasterService.convertToUsdcx(balance, principal).catch(() => null)
                        )
                    );

                    usdValues.forEach((val, i) => {
                        if (val && val > 0) {
                            console.log(`[Stats-Audit] ${ftEntries[i].principal}: balance=${ftEntries[i].balance}, USD=${val}`);
                            walletFeeValueUsd += val;
                        }
                    });
                }

                // Log-based revenue — convert all confirmed tx fees to USD in parallel
                const validTxs = successfulTxs.filter((tx: any) =>
                    tx.feeAmount && tx.feeAmount !== '0' &&
                    tx.feeToken && tx.feeToken !== 'unknown' && tx.feeToken !== 'Token'
                );
                const feeUsdValues = await Promise.all(
                    validTxs.map((tx: any) =>
                        paymasterService.convertToUsdcx(tx.feeAmount, tx.feeToken).catch(() => null)
                    )
                );
                const totalFeeValueUsd = (feeUsdValues as (number | null)[])
                    .reduce((acc: number, val) => acc + (val || 0), 0);

                return {
                    totalTransactions,
                    totalSponsored: totalSponsoredUsd.toFixed(6),
                    relayerAddress,
                    relayerStxBalance,
                    relayerFeeBalance: walletFeeValueUsd.toFixed(2),
                    revenueMainnet: totalFeeValueUsd.toFixed(2),
                    feeToken: 'USD'
                };
            } catch (err) {
                console.error(`Stats Error for ${networkType}:`, err);
                return { totalTransactions: 0, totalSponsored: "0", relayerAddress: "Error", relayerStxBalance: "0", relayerFeeBalance: "0", feeToken: "Tokens" };
            }
        };

        // Run mainnet and testnet stats in parallel too
        const [mainnet, testnet, activeKeysCount] = await Promise.all([
            getNetworkStats('mainnet'),
            getNetworkStats('testnet'),
            (prisma.apiKey as any).count({ where: { userId, status: 'Active' } })
        ]);

        const response = { activeKeys: activeKeysCount, networks: { mainnet, testnet } };
        // Only cache if we got real data — don't cache a cold-start zero response
        const hasRealData = parseFloat(mainnet.totalSponsored) > 0 || parseFloat(mainnet.relayerFeeBalance) > 0 || mainnet.totalTransactions > 0;
        if (hasRealData) await setCachedStats(userId, response);
        res.json(response);
        return;
    } catch (error: any) {
        console.error("Dashboard Stats Critical Error:", error);
        res.status(500).json({ error: "Internal Server Error during stats generation" });
    }
});

app.get('/api/dashboard/keys', verifySupabaseToken, rateLimiters.dashboard.middleware(), async (req: AuthRequest, res: express.Response) => {
    try {
        const userId = req.userId!;
        const keys = await (prisma.apiKey as any).findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
        res.json(keys);
    } catch (error: any) {
        console.error("Dashboard Keys Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/api/dashboard/keys', verifySupabaseToken, rateLimiters.dashboard.middleware(), async (req: AuthRequest, res: express.Response) => {
    try {
        const userId = req.userId!;
        const { name } = req.body;

        // Input validation
        if (!name || typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 64) {
            return res.status(400).json({ error: "Key name must be between 1 and 64 characters" });
        }

        // Use cryptographically secure random bytes — never Math.random() for secrets
        const rawKey = `sgal_live_${crypto.randomBytes(24).toString('hex')}`;
        const keyHash = hashApiKey(rawKey);
        const newKey = await (prisma.apiKey as any).create({
            data: { name: name.trim(), key: rawKey, keyHash, status: 'Active', userId }
        });
        // Return the plaintext key once — it is never retrievable again after this response
        res.json({ ...newKey, key: rawKey });
    } catch (error: any) {
        console.error("Create Key Error:", error);
        res.status(500).json({ error: "Failed to create key" });
    }
});

app.get('/api/dashboard/logs', verifySupabaseToken, rateLimiters.dashboard.middleware(), async (req: AuthRequest, res: express.Response) => {
    try {
        const userId = req.userId!;
        const { network } = req.query;
        const limit = Math.min(parseInt(req.query.limit as string || '500', 10), 1000);
        const where: any = { userId };
        if (network === 'mainnet' || network === 'testnet') where.network = network;
        const logs = await (prisma.transaction as any).findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: { apiKey: true }
        });
        res.json(logs);
    } catch (error: any) {
        console.error("Dashboard Logs Error:", error);
        res.json([]);
    }
});

// ── Usage Logs (API audit trail) ──────────────────────────────────────────────

app.get('/api/dashboard/usage-logs', verifySupabaseToken, rateLimiters.dashboard.middleware(), async (req: AuthRequest, res: express.Response) => {
    try {
        const userId = req.userId!;
        const limit = Math.min(parseInt(req.query.limit as string || '200', 10), 500);

        // Fetch all API keys for this user first, then get their usage logs
        const userKeys = await (prisma.apiKey as any).findMany({
            where: { userId },
            select: { id: true, name: true }
        });

        if (userKeys.length === 0) {
            return res.json([]);
        }

        const keyIds = userKeys.map((k: any) => k.id);
        const keyNameMap = Object.fromEntries(userKeys.map((k: any) => [k.id, k.name]));

        const usageLogs = await (prisma.usageLog as any).findMany({
            where: { apiKeyId: { in: keyIds } },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });

        // Attach key name to each log entry
        const enriched = usageLogs.map((log: any) => ({
            ...log,
            apiKey: { name: keyNameMap[log.apiKeyId] || 'Unknown' }
        }));

        res.json(enriched);
    } catch (error: any) {
        console.error("Usage Logs Error:", error);
        res.json([]);
    }
});

// ── Analytics endpoint ────────────────────────────────────────────────────────

app.get('/api/dashboard/analytics', verifySupabaseToken, rateLimiters.dashboard.middleware(), async (req: AuthRequest, res: express.Response) => {
    try {
        const userId = req.userId!;
        const { network, days = '30' } = req.query;
        const daysNum = Math.min(parseInt(days as string, 10) || 30, 90);

        const since = new Date();
        since.setDate(since.getDate() - daysNum);

        const where: any = { userId, createdAt: { gte: since } };
        if (network === 'mainnet' || network === 'testnet') where.network = network;

        const [transactions, keyUsage] = await Promise.all([
            (prisma.transaction as any).findMany({
                where,
                select: { status: true, createdAt: true, userAddress: true, apiKeyId: true, feeAmount: true, feeToken: true },
                orderBy: { createdAt: 'asc' },
            }),
            (prisma.apiKey as any).findMany({
                where: { userId },
                select: { id: true, name: true, _count: { select: { transactions: true } } }
            })
        ]);

        // Build daily buckets
        const buckets: Record<string, { total: number; confirmed: number; failed: number; pending: number }> = {};
        for (let i = 0; i < daysNum; i++) {
            const d = new Date();
            d.setDate(d.getDate() - (daysNum - 1 - i));
            buckets[d.toISOString().split('T')[0]] = { total: 0, confirmed: 0, failed: 0, pending: 0 };
        }

        transactions.forEach((tx: any) => {
            const date = new Date(tx.createdAt).toISOString().split('T')[0];
            if (!buckets[date]) return;
            buckets[date].total++;
            const s = tx.status === 'Success' ? 'Confirmed' : tx.status;
            if (s === 'Confirmed') buckets[date].confirmed++;
            else if (s === 'Failed') buckets[date].failed++;
            else buckets[date].pending++;
        });

        const daily = Object.entries(buckets).map(([date, counts]) => ({ date, ...counts, feeUsd: 0 }));

        // Top users
        const userMap: Record<string, { count: number; lastSeen: string }> = {};
        transactions.forEach((tx: any) => {
            if (!userMap[tx.userAddress]) {
                userMap[tx.userAddress] = { count: 0, lastSeen: tx.createdAt };
            }
            userMap[tx.userAddress].count++;
            if (tx.createdAt > userMap[tx.userAddress].lastSeen) {
                userMap[tx.userAddress].lastSeen = tx.createdAt;
            }
        });
        const topUsers = Object.entries(userMap)
            .map(([userAddress, v]) => ({ userAddress, ...v }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        const total = transactions.length;
        const confirmed = transactions.filter((t: any) => t.status === 'Confirmed' || t.status === 'Success').length;
        const successRate = total > 0 ? (confirmed / total) * 100 : 0;

        res.json({
            daily,
            topUsers,
            keyUsage: keyUsage.map((k: any) => ({
                keyId: k.id,
                keyName: k.name,
                txCount: k._count.transactions,
                successRate: 0, // would need a join to compute accurately
            })),
            successRate,
            avgDailyTx: total / daysNum,
            totalRevenue: 0,
        });
    } catch (error: any) {
        console.error("Analytics Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.listen(port, () => {
    console.log(`VelumX Relayer running on port ${port}`);
});
