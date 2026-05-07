import { AlexSDK } from 'alex-sdk';
import { BitflowSDK } from '@bitflowlabs/core-sdk';
import { Redis } from 'ioredis';

interface PriceSource {
    name: string;
    getPrice: () => Promise<number | null>;
}

interface TokenUsdSource {
    name: string;
    getUsdPrice: (token: string) => Promise<number | null>;
}

// Redis-backed cache with in-memory fallback.
class PriceCache {
    private redis: Redis | null = null;
    private memory: Map<string, { price: number; timestamp: number }> = new Map();
    private readonly TTL_MS: number;
    private readonly TTL_SECONDS: number;

    constructor(ttlMs: number) {
        this.TTL_MS = ttlMs;
        this.TTL_SECONDS = Math.floor(ttlMs / 1000);

        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
            this.redis = new Redis(redisUrl, {
                maxRetriesPerRequest: 1,
                connectTimeout: 3000,
                lazyConnect: true,
                enableOfflineQueue: false,
            });
            this.redis.connect().catch(() => {
                console.warn('[Oracle] Redis connection failed — falling back to in-memory cache');
                this.redis = null;
            });
            this.redis.on('error', () => {});
        } else {
            console.log('[Oracle] REDIS_URL not set — using in-memory price cache');
        }
    }

    async get(key: string): Promise<number | null> {
        if (this.redis) {
            try {
                const val = await this.redis.get(`oracle:${key}`);
                if (val !== null) return parseFloat(val);
            } catch {}
        }
        const entry = this.memory.get(key);
        if (entry && Date.now() - entry.timestamp < this.TTL_MS) return entry.price;
        return null;
    }

    async set(key: string, price: number): Promise<void> {
        if (this.redis) {
            try {
                await this.redis.set(`oracle:${key}`, price.toString(), 'EX', this.TTL_SECONDS);
            } catch {}
        }
        this.memory.set(key, { price, timestamp: Date.now() });
    }

    async del(key?: string): Promise<void> {
        if (key) {
            this.memory.delete(key);
            if (this.redis) { try { await this.redis.del(`oracle:${key}`); } catch {} }
        } else {
            this.memory.clear();
            if (this.redis) {
                try {
                    const keys = await this.redis.keys('oracle:*');
                    if (keys.length > 0) await this.redis.del(...keys);
                } catch {}
            }
        }
    }

    stats() {
        return { memoryEntries: this.memory.size, redisConnected: this.redis !== null };
    }
}

/**
 * Pricing Oracle Service
 * Token price source order: Binance (CEX, most accurate) → ALEX SDK (DEX) → CoinGecko
 * STX price source order: Binance → CoinCap → CoinGecko → ALEX SDK (on-chain fallback)
 * Cache: Redis (30 sec TTL) with in-memory fallback
 */
export class PricingOracleService {
    private alex: AlexSDK;
    private bitflow: BitflowSDK;
    private readonly cache = new PriceCache(30 * 1000); // 30 sec TTL — prices move fast
    private metadataCache: Map<string, { symbol: string, decimals: number }> = new Map();
    private readonly hiroHeaders: Record<string, string>;

    private readonly KNOWN_DECIMALS: Record<string, number> = {
        'token-alex': 8, 'age000-governance-token': 8,
        'sbtc-token': 8, 'token-wbtc': 8,
        'usdcx': 6, 'token-aeusdc': 6, 'aeusdc': 6,
        'token-wstx': 6, 'stx': 6, 'token-susdt': 8,
        'token-ausd': 8,
    };

    private readonly STABLECOINS = new Set([
        // Short names / ALEX SDK IDs
        'token-aeusdc', 'aeusdc', 'token-susdt', 'usdcx', 'token-ausd',
        // Full Stacks principals
        'SP3Y2ZSH8P7D50B0JLZVGKMBC7PX3RVRGWJKWKY38.token-aeusdc',
        'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx',
        'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-susdt', // sUSDT on Stacks
    ]);

    // Full Stacks principal → ALEX SDK internal token ID
    private readonly PRINCIPAL_TO_ALEX_ID: Record<string, string> = {
        'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex': 'age000-governance-token',
        'SP3Y2ZSH8P7D50B0JLZVGKMBC7PX3RVRGWJKWKY38.token-aeusdc': 'token-aeusdc',
        'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token': 'token-wbtc',
        'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx': 'token-susdt',
    };

    // ALEX SDK ID → Binance spot pair (CEX ground truth)
    private readonly ALEX_ID_TO_BINANCE: Record<string, string> = {
        'age000-governance-token': 'ALEXUSDT', // ALEX token
        'token-wbtc': 'BTCUSDT',               // sBTC = wrapped BTC, same price as BTC
        'token-wstx': 'STXUSDT',               // wSTX = STX
    };

    // ALEX SDK ID → CoinGecko ID
    private readonly ALEX_ID_TO_CG: Record<string, string> = {
        'age000-governance-token': 'alexgo',
        'token-wbtc': 'bitcoin',
        'token-susdt': 'tether',
        'token-aeusdc': 'usd-coin',
    };

    constructor() {
        this.alex = new AlexSDK();
        this.bitflow = new BitflowSDK({
            BITFLOW_API_HOST: 'https://api.bitflowapis.finance',
            READONLY_CALL_API_HOST: 'https://node.bitflowapis.finance'
        });
        const hiroApiKey = process.env.HIRO_API_KEY;
        this.hiroHeaders = hiroApiKey ? { 'x-api-key': hiroApiKey } : {};
        if (hiroApiKey) {
            console.log('[Oracle] Hiro API key loaded — using authenticated requests.');
        } else {
            console.warn('[Oracle] HIRO_API_KEY not set — using unauthenticated Hiro requests (rate limit: 50 req/min).');
        }
    }

    public async getTokenMetadata(token: string): Promise<{ symbol: string, decimals: number }> {
        const normalized = token.includes('.') ? token.split('.').pop()!.toLowerCase() : token.toLowerCase();

        if (this.KNOWN_DECIMALS[normalized]) return { symbol: normalized.toUpperCase(), decimals: this.KNOWN_DECIMALS[normalized] };
        if (this.metadataCache.has(token)) return this.metadataCache.get(token)!;

        // 1. Try ALEX SDK
        try {
            const allTokens = await this.alex.fetchSwappableCurrency();
            const match = allTokens.find((t: any) => {
                const contractAddr = t.wrapToken ? t.wrapToken.split('::')[0] : t.id;
                return contractAddr?.toLowerCase() === token.toLowerCase() || t.id?.toLowerCase() === token.toLowerCase();
            });
            if (match) {
                const meta = {
                    symbol: match.name || match.id || 'TOKEN',
                    decimals: match.wrapTokenDecimals ?? match.underlyingTokenDecimals ?? 8
                };
                this.metadataCache.set(token, meta);
                return meta;
            }
        } catch {}

        // 2. Try Bitflow SDK
        try {
            const bitflowTokens = await this.bitflow.getAvailableTokens();
            const match = bitflowTokens.find(t => t.tokenContract?.toLowerCase() === token.toLowerCase());
            if (match) {
                const meta = { symbol: match.symbol, decimals: match.tokenDecimals ?? 6 };
                this.metadataCache.set(token, meta);
                return meta;
            }
        } catch {}

        // 3. Fallback: Hiro API
        if (token.includes('.')) {
            try {
                const [addr, name] = token.split('.');
                const res = await fetch(`https://api.hiro.so/metadata/v1/ft/${addr}.${name}`, {
                        signal: AbortSignal.timeout(3000),
                        headers: this.hiroHeaders,
                    });
                if (res.ok) {
                    const data = await res.json();
                    if (data.decimals !== undefined) {
                        const meta = { symbol: data.symbol || 'TOKEN', decimals: data.decimals };
                        this.metadataCache.set(token, meta);
                        return meta;
                    }
                }
            } catch {}
        }

        return { symbol: normalized.toUpperCase(), decimals: 6 };
    }

    // ── STX Price ─────────────────────────────────────────────────────────────
    // Order: Binance → CoinCap → CoinGecko → ALEX SDK (on-chain last resort)

    public async getStxPrice(): Promise<number | null> {
        const cacheKey = 'stx-usd';
        const cached = await this.cache.get(cacheKey);
        if (cached !== null) return cached;

        const sources: PriceSource[] = [
            {
                name: 'Binance',
                getPrice: async () => {
                    try {
                        const res = await fetch(
                            'https://api.binance.com/api/v3/ticker/price?symbol=STXUSDT',
                            { signal: AbortSignal.timeout(5000) }
                        );
                        if (res.ok) {
                            const data = await res.json();
                            return parseFloat(data.price) || null;
                        }
                        return null;
                    } catch { return null; }
                }
            },
            {
                name: 'CoinCap',
                getPrice: async () => {
                    try {
                        const res = await fetch('https://api.coincap.io/v2/assets/blockstack', { signal: AbortSignal.timeout(8000) });
                        if (res.ok) {
                            const data = await res.json();
                            return parseFloat(data.data?.priceUsd) || null;
                        }
                        return null;
                    } catch { return null; }
                }
            },
            {
                name: 'CoinGecko',
                getPrice: async () => {
                    try {
                        const res = await fetch(
                            'https://api.coingecko.com/api/v3/simple/price?ids=blockstack&vs_currencies=usd',
                            { signal: AbortSignal.timeout(5000) }
                        );
                        if (res.ok) {
                            const data = await res.json();
                            return data.blockstack?.usd || null;
                        }
                        return null;
                    } catch { return null; }
                }
            },
            {
                // On-chain last resort: price 1 aUSD (~$1) against wSTX on ALEX DEX, then invert.
                // ALEX SDK always uses 8-decimal scale internally for all tokens.
                name: 'ALEX SDK (aUSD/wSTX)',
                getPrice: async () => {
                    try {
                        const amountOut = await this.alex.getAmountTo(
                            'token-ausd' as any,
                            BigInt(1e8), // 1 aUSD in ALEX's 8-decimal scale
                            'token-wstx' as any
                        );
                        if (!amountOut || Number(amountOut) <= 0) return null;
                        // amountOut is in ALEX's internal wSTX scale (8 decimals)
                        // 1 aUSD ≈ $1 → STX per $1 = amountOut/1e8 → $/STX = 1/(amountOut/1e8)
                        const stxPerUsd = Number(amountOut) / 1e8;
                        return stxPerUsd > 0 ? 1 / stxPerUsd : null;
                    } catch { return null; }
                }
            },
        ];

        for (const source of sources) {
            try {
                const price = await source.getPrice();
                if (price && price > 0) {
                    console.log(`[Oracle] STX price from ${source.name}: $${price}`);
                    await this.cache.set(cacheKey, price);
                    return price;
                }
            } catch {}
        }

        console.error('[Oracle] ALL STX price sources failed.');
        return null;
    }

    // ── Token USD Price ───────────────────────────────────────────────────────
    // Order: Binance (CEX, ground truth) → ALEX SDK (DEX) → CoinGecko → aUSD fallback

    public async getTokenUsdPrice(token: string, tokenDecimals: number = 6): Promise<number | null> {
        const cacheKey = `token-usd-${token}`;
        const cached = await this.cache.get(cacheKey);
        if (cached !== null) return cached;

        if (token === 'STX' || token.toLowerCase().includes('wstx')) {
            return this.getStxPrice();
        }

        const normalizedToken = token.includes('.') ? token.split('.').pop()!.toLowerCase() : token.toLowerCase();
        if (this.STABLECOINS.has(token) || this.STABLECOINS.has(normalizedToken)) {
            await this.cache.set(cacheKey, 1.0);
            return 1.0;
        }

        const alexId = this.PRINCIPAL_TO_ALEX_ID[token] || normalizedToken;

        const sources: TokenUsdSource[] = [
            {
                // Binance is the CEX ground truth — most accurate, no rate limits, real market price
                name: 'Binance',
                getUsdPrice: async (id: string) => {
                    const pair = this.ALEX_ID_TO_BINANCE[id];
                    if (!pair) return null;
                    try {
                        const res = await fetch(
                            `https://api.binance.com/api/v3/ticker/price?symbol=${pair}`,
                            { signal: AbortSignal.timeout(5000) }
                        );
                        if (res.ok) {
                            const data = await res.json();
                            const price = parseFloat(data.price);
                            if (price > 0) {
                                console.log(`[Oracle] ${id} via Binance: $${price}`);
                                return price;
                            }
                        }
                        return null;
                    } catch { return null; }
                }
            },
            {
                // ALEX SDK DEX price — used for tokens not listed on Binance.
                // Pass the token's actual native micro-unit amount (10^decimals = 1 full token).
                // amountOut is in ALEX's internal wSTX scale (8 decimals) → divide by 1e8 to get real STX.
                name: 'ALEX SDK (via wSTX)',
                getUsdPrice: async (id: string) => {
                    try {
                        const amountOut = await this.alex.getAmountTo(
                            id as any,
                            BigInt(10 ** tokenDecimals), // 1 full token in native micro-units
                            'token-wstx' as any
                        );
                        if (!amountOut || Number(amountOut) <= 0) return null;
                        // amountOut is in ALEX's internal wSTX scale (8 decimals)
                        const stxPerToken = Number(amountOut) / 1e8;
                        const stxUsd = await this.getStxPrice();
                        if (!stxUsd) return null;
                        const usdPrice = stxPerToken * stxUsd;
                        console.log(`[Oracle] ${id} via ALEX/wSTX: ${stxPerToken} STX = $${usdPrice.toFixed(8)}`);
                        return usdPrice > 0 ? usdPrice : null;
                    } catch (e) {
                        console.warn(`[Oracle] ALEX SDK (wSTX) failed for ${id}:`, (e as Error).message);
                        return null;
                    }
                }
            },
            {
                // Bitflow SDK pricing
                name: 'Bitflow SDK',
                getUsdPrice: async (id: string) => {
                    try {
                        const tokens = await this.bitflow.getAvailableTokens();
                        const match = tokens.find(t => 
                            (t.tokenContract && t.tokenContract.toLowerCase() === token.toLowerCase()) || 
                            (t.tokenId && t.tokenId === id)
                        );
                        if (!match) return null;

                        const result = await this.bitflow.getQuoteForRoute(match.tokenId, 'token-wstx', 1);
                        const best = result.bestRoute;
                        if (!best || best.quote == null || best.quote <= 0) return null;

                        // best.quote is amount of STX for 1 token in human-readable units (e.g. 1.25 STX)
                        const stxPerToken = best.quote;
                        const stxUsd = await this.getStxPrice();
                        if (!stxUsd) return null;
                        
                        const usdPrice = stxPerToken * stxUsd;
                        console.log(`[Oracle] ${token} via Bitflow: ${stxPerToken} STX = $${usdPrice.toFixed(8)}`);
                        return usdPrice;
                    } catch (e) {
                        console.warn(`[Oracle] Bitflow failed for ${token}:`, (e as Error).message);
                        return null;
                    }
                }
            },
            {
                name: 'Velar API',
                getUsdPrice: async (id: string) => {
                    try {
                        // Velar public API endpoint for pricing
                        const res = await fetch(`https://api.velar.co/ticker`, { signal: AbortSignal.timeout(5000) });
                        if (res.ok) {
                            const data = await res.json();
                            // Look for the token principal in the tickers
                            const ticker = data.find((t: any) => 
                                (t.base_symbol && t.base_symbol.toLowerCase() === id) || 
                                (t.base_address && t.base_address.toLowerCase() === token.toLowerCase())
                            );
                            if (ticker && ticker.last_price) {
                                const stxUsd = await this.getStxPrice();
                                if (!stxUsd) return null;
                                const usdPrice = parseFloat(ticker.last_price) * stxUsd;
                                console.log(`[Oracle] ${token} via Velar: $${usdPrice.toFixed(8)}`);
                                return usdPrice;
                            }
                        }
                        return null;
                    } catch { return null; }
                }
            },
            {
                name: 'CoinGecko',
                getUsdPrice: async (id: string) => {
                    const cgId = this.ALEX_ID_TO_CG[id];
                    if (!cgId) return null;
                    try {
                        const res = await fetch(
                            `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`,
                            { signal: AbortSignal.timeout(5000) }
                        );
                        if (res.ok) {
                            const data = await res.json();
                            const usdPrice = data[cgId]?.usd;
                            if (usdPrice && usdPrice > 0) {
                                console.log(`[Oracle] ${id} via CoinGecko: $${usdPrice}`);
                                return usdPrice;
                            }
                        }
                        return null;
                    } catch { return null; }
                }
            }
        ];

        for (const source of sources) {
            try {
                const usdPrice = await source.getUsdPrice(alexId);
                if (usdPrice && usdPrice > 0) {
                    await this.cache.set(cacheKey, usdPrice);
                    return usdPrice;
                }
            } catch {}
        }

        // Last resort: price token against aUSD on ALEX DEX.
        // aUSD is pegged to $1. Pass 1 full token in native micro-units.
        try {
            const amountOut = await this.alex.getAmountTo(
                alexId as any,
                BigInt(10 ** tokenDecimals), // 1 full token in native micro-units
                'token-ausd' as any
            );
            if (amountOut && Number(amountOut) > 0) {
                // amountOut is in ALEX's internal aUSD scale (8 decimals) → divide by 1e8 to get USD
                const usdPrice = Number(amountOut) / 1e8;
                console.log(`[Oracle] ${alexId} via ALEX/aUSD fallback: $${usdPrice.toFixed(8)}`);
                await this.cache.set(cacheKey, usdPrice);
                return usdPrice;
            }
        } catch (e) {
            console.warn(`[Oracle] aUSD fallback failed for ${alexId}:`, (e as Error).message);
        }

        console.error(`[Oracle] All sources failed for ${token} (alexId=${alexId})`);
        return null;
    }

    // Legacy: returns STX per token
    public async getTokenRate(token: string, tokenDecimals: number = 6): Promise<number | null> {
        const usdPrice = await this.getTokenUsdPrice(token, tokenDecimals);
        const stxUsd = await this.getStxPrice();
        if (usdPrice === null || stxUsd === null || stxUsd === 0) return null;
        return usdPrice / stxUsd;
    }

    // Convert raw micro-amount to USD
    public async convertToUsdcx(amount: string | bigint, token: string, tokenDecimals?: number): Promise<number | null> {
        const rawAmount = BigInt(amount);
        if (rawAmount === BigInt(0)) return 0;

        let decimals = tokenDecimals;
        if (decimals === undefined) {
            const meta = await this.getTokenMetadata(token);
            decimals = meta.decimals;
        }

        const usdPerToken = await this.getTokenUsdPrice(token, decimals);
        if (usdPerToken === null) return null;

        return (Number(rawAmount) / Math.pow(10, decimals)) * usdPerToken;
    }

    /**
     * Get the current recommended fee rate from the Stacks network.
     * Queries /v2/fees/transfer on the public Stacks node (not Hiro) to avoid
     * rate limits. Result is cached for 60 seconds — fee rate changes slowly.
     *
     * Falls back to 5000 microSTX (0.005 STX) if the node is unreachable.
     */
    public async getNetworkFeeRate(network: 'mainnet' | 'testnet' = 'mainnet'): Promise<number> {
        const cacheKey = `stacks-fee-rate:${network}`;

        const cached = await this.cache.get(cacheKey);
        if (cached !== null) return cached;

        // Hiro API — works from this server, rate limit is 50 req/min but we cache
        // for 30 seconds so we make at most 2 calls per minute. No risk.
        const nodeBase = network === 'mainnet'
            ? 'https://api.mainnet.hiro.so'
            : 'https://api.testnet.hiro.so';

        try {
            const res = await fetch(`${nodeBase}/v2/fees/transfer`, {
                signal: AbortSignal.timeout(3000),
                headers: this.hiroHeaders,
            });

            if (res.ok) {
                const text = await res.text();
                const feeRate = parseInt(text.trim(), 10);

                if (!isNaN(feeRate) && feeRate > 0) {
                    // A typical sponsored contract-call is ~250–400 bytes.
                    // 300 bytes is a conservative middle estimate.
                    const ESTIMATED_TX_BYTES = 300;
                    const totalMicroStx = feeRate * ESTIMATED_TX_BYTES;

                    // Clamp: floor 1000 µSTX (0.001 STX), ceiling 50000 µSTX (0.05 STX)
                    const clampedFee = Math.max(1000, Math.min(50000, totalMicroStx));

                    console.log(`[FeeOracle] ${network}: ${feeRate} µSTX/byte → ${totalMicroStx} µSTX → clamped: ${clampedFee} µSTX`);

                    await this.cache.set(cacheKey, clampedFee);
                    return clampedFee;
                }
            }
        } catch (err: any) {
            console.warn(`[FeeOracle] Failed to fetch fee rate (${network}):`, err.message);
        }

        // Fallback: 5000 microSTX — same as the old hardcoded value
        const FALLBACK_FEE = 5000;
        console.warn(`[FeeOracle] Using fallback fee: ${FALLBACK_FEE} µSTX`);
        return FALLBACK_FEE;
    }

    public async clearCache(key?: string): Promise<void> {
        await this.cache.del(key);
    }

    public getCacheStats() {
        return this.cache.stats();
    }
}
