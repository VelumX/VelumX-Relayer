import {
    makeContractCall,
    broadcastTransaction,
    AnchorMode,
    PostConditionMode,
    uintCV,
    principalCV,
    someCV,
    noneCV,
    bufferCV,
    listCV,
    deserializeTransaction,
    sponsorTransaction,
    Cl,
    getAddressFromPrivateKey,
} from '@stacks/transactions';
import { StacksNetwork, STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import { PricingOracleService } from './services/PricingOracleService.js';

const prisma = new PrismaClient();

// Maps known token symbols/IDs (as stored in developer dashboard) to mainnet contract principals.
// Allows developers to configure tokens by symbol while the frontend sends full principals.
const KNOWN_TOKEN_CONTRACTS: Record<string, string> = {
    'ALEX': 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex',
    'age000-governance-token': 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex',
    'token-alex': 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex',
    'USDCx': 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx',
    'usdcx': 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx',
    'aeUSDC': 'SP3Y2ZSH8P7D50B0JLZVGKMBC7PX3RVRGWJKWKY38.token-aeusdc',
    'token-aeusdc': 'SP3Y2ZSH8P7D50B0JLZVGKMBC7PX3RVRGWJKWKY38.token-aeusdc',
    'sBTC': 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
    'sbtc-token': 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
};

// Simple interface matching the SDK
interface SignedIntent {
    target: string;
    payload: string; // Packed transaction buffer
    maxFee: string | number;
    feeToken?: string; // New: Supports Universal Token Gas
    nonce: string | number;
    signature: string;
    network?: 'mainnet' | 'testnet'; // Optional network flag
}

export class PaymasterService {
    private mainnetNetwork: StacksNetwork;
    private testnetNetwork: StacksNetwork;
    private relayerKey: string;
    private pricingOracle: PricingOracleService;

    // ── Item 1: Replay protection ─────────────────────────────────────────────
    // Map<txHex, expiryTimestamp> — 24-hour TTL per entry
    private processedTxHashes: Map<string, number> = new Map();
    private readonly REPLAY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
    // ─────────────────────────────────────────────────────────────────────────

    constructor() {
        this.mainnetNetwork = STACKS_MAINNET;
        this.testnetNetwork = STACKS_TESTNET;
        this.pricingOracle = new PricingOracleService();
        const rawKey = (process.env.RELAYER_PRIVATE_KEY || '').trim();
        this.relayerKey = this.sanitizePrivateKey(rawKey);

        if (!this.relayerKey) {
            console.warn("WARNING: RELAYER_PRIVATE_KEY not set. Sponsorship will fail.");
        } else {
            console.log("Relayer Key initialized and sanitized for Universal Gas.");
        }

        // Periodically evict expired replay-protection entries (every 30 minutes)
        setInterval(() => this.cleanupReplayCache(), 30 * 60 * 1000);
    }

    // ── Item 1: Replay cache helpers ──────────────────────────────────────────
    private cleanupReplayCache(): void {
        const now = Date.now();
        for (const [key, expiry] of this.processedTxHashes) {
            if (now > expiry) this.processedTxHashes.delete(key);
        }
    }

    private isReplay(txHex: string): boolean {
        const expiry = this.processedTxHashes.get(txHex);
        if (expiry === undefined) return false;
        if (Date.now() > expiry) {
            this.processedTxHashes.delete(txHex);
            return false;
        }
        return true;
    }

    private markProcessed(txHex: string): void {
        this.processedTxHashes.set(txHex, Date.now() + this.REPLAY_TTL_MS);
    }
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Get the correct Paymaster contract address for the target network
     */
    public getPaymasterAddress(network: 'mainnet' | 'testnet', version: 'v1' | 'v4' | 'v5' | 'relayer-v1' = 'relayer-v1'): string {
        if (network === 'mainnet') {
            if (version === 'v4') return process.env.PAYMASTER_CONTRACT_MAINNET || 'SPKYNF473GQ1V0WWCF24TV7ZR1WYAKTC7AM8QGBW.simple-paymaster-v4';
            if (version === 'v5') return process.env.PAYMASTER_V5_MAINNET || 'SPKYNF473GQ1V0WWCF24TV7ZR1WYAKTC7AM8QGBW.universal-paymaster-v5';
            if (version === 'v1') return process.env.PAYMASTER_V1_MAINNET || 'SPKYNF473GQ1V0WWCF24TV7ZR1WYAKTC7AM8QGBW.velumx-paymaster-1-1';
            return process.env.PAYMASTER_RELAYER_V1_MAINNET || 'SPKYNF473GQ1V0WWCF24TV7ZR1WYAKTC7AM8QGBW.velumx-relayer-1';
        }
        if (version === 'v4') return process.env.PAYMASTER_CONTRACT_TESTNET || 'STKYNF473GQ1V0WWCF24TV7ZR1WYAKTC79V25E3P.simple-paymaster-v4';
        if (version === 'v5') return process.env.PAYMASTER_V5_TESTNET || 'STKYNF473GQ1V0WWCF24TV7ZR1WYAKTC79V25E3P.universal-paymaster-v5';
        if (version === 'v1') return process.env.PAYMASTER_V1_TESTNET || 'STKYNF473GQ1V0WWCF24TV7ZR1WYAKTC79V25E3P.velumx-paymaster-1';
        return process.env.PAYMASTER_RELAYER_V1_TESTNET || 'STKYNF473GQ1V0WWCF24TV7ZR1WYAKTC79V25E3P.velumx-relayer-1';
    }

    /**
     * Get the Registry v1 contract address for the target network
     */
    public getRegistryAddress(network: 'mainnet' | 'testnet'): string {
        if (network === 'mainnet') {
            return process.env.REGISTRY_V1_MAINNET || 'SPKYNF473GQ1V0WWCF24TV7ZR1WYAKTC7AM8QGBW.velumx-registry-v1';
        }
        return process.env.REGISTRY_V1_TESTNET || 'STKYNF473GQ1V0WWCF24TV7ZR1WYAKTC79V25E3P.velumx-registry-v1';
    }


    private sanitizePrivateKey(key: string): string {
        if (!key) return '';
        // Remove 0x prefix if present
        let sanitized = key.startsWith('0x') ? key.substring(2) : key;

        // Stacks/Bitcoin private keys are typically 32 bytes (64 hex chars)
        // or 33 bytes (66 hex chars) where the last byte is 01 to indicate compression.
        if (sanitized.length === 64) {
            console.log("Relayer: Appending mandatory compression suffix '01' to 32-byte key.");
            sanitized += '01';
        } else if (sanitized.length === 66) {
            const suffix = sanitized.substring(64);
            if (suffix !== '01') {
                console.warn(`Relayer: Key is 33 bytes but suffix is '${suffix}' instead of '01'. Forcing '01' for Stacks compatibility.`);
                sanitized = sanitized.substring(0, 64) + '01';
            }
        } else if (sanitized.length !== 66) {
            console.error(`Relayer: Private key has unconventional length (${sanitized.length}). Stacks expects 64 or 66 chars.`);
        }

        return sanitized;
    }

    /**
     * Deterministically derive a unique relayer key for a specific developer
     * based on their Supabase User ID and the Relayer's Master Key.
     */
    public getUserRelayerKey(userId: string): string {
        if (!this.relayerKey) throw new Error("Relayer master key not configured");
        if (!userId) throw new Error("User ID required for key derivation");

        try {
            // 1. Get the RAW 32-byte seed (remove any 01 suffix from the master key for derivation)
            const masterSeed = this.relayerKey.length === 66 ? this.relayerKey.substring(0, 64) : this.relayerKey;

            // 2. Derive a deterministic 32-byte sub-key using HMAC-SHA256
            const hmac = crypto.createHmac('sha256', Buffer.from(masterSeed, 'hex'));
            hmac.update(userId);
            const subKey = hmac.digest('hex');

            // 3. SECP256K1 Validation & Compression Suffix
            // We append '01' to indicate this is a compressed public key, which Stacks requires.
            return subKey + '01';
        } catch (error) {
            console.error(`Relayer: Failed to derive key for user ${userId}`, error);
            throw new Error("Multi-tenant key derivation failed");
        }
    }

    /**
     * Get real-time Price for a specific token relative to microSTX using multiple oracles
     * Returns: Amount of STX per 1 unit of token
     */
    public async getTokenRate(token: string, tokenDecimals: number = 6): Promise<number | null> {
        return this.pricingOracle.getTokenRate(token, tokenDecimals);
    }

    /**
     * Get the current STX price in USD/USDCx using multiple oracles
     */
    public async getStxPrice(): Promise<number | null> {
        return this.pricingOracle.getStxPrice();
    }

    public async getTokenMetadata(token: string) {
        return this.pricingOracle.getTokenMetadata(token);
    }

    /**
     * Convert any token amount to its USDCx (USD) equivalent
     */
    public async convertToUsdcx(amount: string | bigint, token: string, tokenDecimals?: number): Promise<number | null> {
        return this.pricingOracle.convertToUsdcx(amount, token, tokenDecimals);
    }

    /**
     * Validate if a user has enough balance of a specific token
     * @param userAddress - Stacks address of the user
     * @param tokenPrincipal - Contract principal of the token
     * @param requiredAmount - Minimum required amount in micro-units
     * @param network - 'mainnet' or 'testnet'
     */
    public async validateUserBalance(userAddress: string, tokenPrincipal: string, requiredAmount: bigint, network: 'mainnet' | 'testnet' = 'mainnet'): Promise<boolean> {
        try {
            const apiBase = network === 'mainnet' ? 'https://api.mainnet.hiro.so' : 'https://api.testnet.hiro.so';
            const res = await fetch(`${apiBase}/extended/v1/address/${userAddress}/balances`, { signal: AbortSignal.timeout(5000) });

            if (!res.ok) return true; // Default to true on API error to avoid blocking legit txs

            const data = await res.json();

            // 1. Handle STX
            if (tokenPrincipal === 'STX' || tokenPrincipal === 'token-wstx' || tokenPrincipal.toLocaleLowerCase().includes('wstx')) {
                const balance = BigInt(data.stx?.balance || '0');
                return balance >= requiredAmount;
            }

            // 2. Handle Fungible Tokens
            const ftBalances = data.fungible_tokens || {};
            // The key in ftBalances is "PRINCIPAL::NAME"
            const matchingKey = Object.keys(ftBalances).find(k => k.startsWith(tokenPrincipal));

            if (!matchingKey) return requiredAmount === 0n;

            const balance = BigInt(ftBalances[matchingKey].balance || '0');
            return balance >= requiredAmount;
        } catch (error) {
            console.warn(`Balance validation failed for ${userAddress}:`, error);
            return true; // Conservative fallback
        }
    }

    /**
     * Estimate Universal fee for a transaction intent
     */
    public async estimateFee(intent: any, apiKeyId: string) {
        if (!apiKeyId) throw new Error("API key identity required for estimation");

        const apiKey = await (prisma.apiKey as any).findUnique({
            where: { id: apiKeyId },
            select: {
                sponsorshipPolicy: true,
                markupPercentage: true,
                maxSponsoredTxsPerUser: true,
                monthlyLimitUsd: true,
                supportedGasTokens: true
            }
        }) as any;

        if (!apiKey) throw new Error("Developer context not found");

        const userAddress = intent.target || 'unknown';
        const feeToken = intent.feeToken;

        // 1. Sponsorship Policy Check (Developer Pays) — check FIRST before any token validation
        if ((apiKey.sponsorshipPolicy as string) === 'DEVELOPER_SPONSORS') {
            // Developer sponsors — user pays nothing, return immediately
            return {
                maxFee: "0",
                feeToken: feeToken || 'STX',
                estimatedGas: intent.estimatedGas || 10000,
                policy: "DEVELOPER_SPONSORS"
            };
        }

        // 2. Token validation only applies when user pays
        if (!feeToken) {
            throw new Error("Universal Gas: Please specify a feeToken contract principal.");
        }

        const supportedTokens = apiKey.supportedGasTokens || [];
        if (supportedTokens.length > 0) {
            // Normalize both sides: resolve known symbols to contract principals for comparison
            const resolvedFeeToken = KNOWN_TOKEN_CONTRACTS[feeToken] || feeToken;
            const isSupported = supportedTokens.some((t: string) => {
                const resolvedT = KNOWN_TOKEN_CONTRACTS[t] || t;
                return resolvedT === resolvedFeeToken || t === feeToken || t === resolvedFeeToken;
            });
            if (!isSupported) {
                throw new Error(`Gas token ${feeToken} is not supported by this developer's policy.`);
            }
        }

        // 3. Universal Pricing (User Pays)
        // Base fee = actual STX gas cost + 20% margin (or developer markup if higher)
        const estimatedGas = intent.estimatedGas || 100000;
        const markupFactor = 1 + (apiKey.markupPercentage / 100);

        // Actual STX gas cost: relayer pays 5,000 microSTX (0.005 STX) per tx
        const RELAYER_STX_FEE = 0.005; // STX
        const stxUsdPrice = await this.pricingOracle.getStxPrice();
        const actualGasCostUsd = stxUsdPrice ? RELAYER_STX_FEE * stxUsdPrice : 0.005;

        // Apply a 20% minimum margin on top of actual gas cost, then apply developer markup
        const MIN_MARGIN = 1.2;
        const MIN_FEE_USD = actualGasCostUsd * MIN_MARGIN;

        // Fetch token metadata reliably using our centralized Oracle
        const { decimals: tokenDecimals } = await this.pricingOracle.getTokenMetadata(feeToken);
        const tokenMicroUnitsPerToken = Math.pow(10, tokenDecimals);

        // Get USD price of 1 full token directly
        const tokenUsdPrice = await this.pricingOracle.getTokenUsdPrice(feeToken, tokenDecimals);
        if (!tokenUsdPrice || tokenUsdPrice <= 0) {
            throw new Error(`Pricing Error: Oracle could not determine a value for ${feeToken}. Sponsoring is disabled for this token until liquidity is detected.`);
        }

        // 4. Calculate Final Fee
        // Multiply by markup factor if provided by developer policy
        const feeInTokens = (MIN_FEE_USD / tokenUsdPrice) * markupFactor;
        const finalFee = BigInt(Math.ceil(feeInTokens * tokenMicroUnitsPerToken));

        // USD value of the final fee (for frontend display)
        const maxFeeUsd = ((Number(finalFee) / tokenMicroUnitsPerToken) * tokenUsdPrice).toFixed(4);

        console.log(`[Fee] token=${feeToken} decimals=${tokenDecimals} usdPrice=$${tokenUsdPrice} finalFee=${finalFee} (~$${maxFeeUsd})`);

        return {
            maxFee: finalFee.toString(),
            maxFeeUsd,
            feeToken,
            estimatedGas,
            policy: "USER_PAYS"
        };
    }

    public async sponsorIntent(intent: SignedIntent, apiKeyId?: string, userId?: string) {
        const activeKey = userId ? this.getUserRelayerKey(userId) : this.relayerKey;

        if (!activeKey) throw new Error("Relayer key not configured");
        if (!intent.feeToken) throw new Error("Universal Gas: feeToken is required");

        console.log("Relayer: Processing account-abstraction intent", {
            target: intent.target,
            token: intent.feeToken,
            tenant: userId || 'MASTER'
        });

        const targetNetwork = intent.network || (process.env.NETWORK as 'mainnet' | 'testnet') || 'mainnet';

        // Perform balance validation to prevent relayer wasting gas
        const hasBalance = await this.validateUserBalance(intent.target, intent.feeToken, BigInt(intent.maxFee), targetNetwork);
        if (!hasBalance) {
            throw new Error(`Insufficient ${intent.feeToken} balance in user wallet to cover the paymaster fee.`);
        }
        const stxNetwork = targetNetwork === 'mainnet' ? this.mainnetNetwork : this.testnetNetwork;
        const paymasterAddress = this.getPaymasterAddress(targetNetwork, 'v4'); // Legacy intents use v4
        const [contractAddress, contractName] = paymasterAddress.split('.');

        const feeTokenPrincipal = intent.feeToken;

        const txOptions = {
            contractAddress,
            contractName,
            functionName: 'call-gasless',
            functionArgs: [
                principalCV(feeTokenPrincipal),
                uintCV(intent.maxFee),
                principalCV(getAddressFromPrivateKey(activeKey, targetNetwork)), // Dynamic Relayer receiver
                principalCV(intent.target),
                Cl.stringAscii('universal-execute'),
                bufferCV(Buffer.from(intent.payload.replace(/^0x/, ''), 'hex'))
            ],
            senderKey: activeKey,
            validateWithAbi: false,
            network: stxNetwork,
            anchorMode: AnchorMode.Any,
            postConditionMode: PostConditionMode.Allow,
            fee: 5000n, // 0.005 STX (microSTX)
        };

        try {
            const transaction = await makeContractCall(txOptions);
            const response = await broadcastTransaction({ transaction, network: stxNetwork });

            if ('error' in response) {
                const errorMsg = response.reason || (response as any).message || JSON.stringify(response);
                throw new Error(`Intent broadcast failed: ${errorMsg}`);
            }

            const txid = response.txid;

            // Save to Database with Multi-tenant association
            try {
                // Resolve feeToken to full principal for accurate decimal resolution later
                const resolvedFeeToken = KNOWN_TOKEN_CONTRACTS[intent.feeToken] || intent.feeToken;
                await (prisma.transaction as any).create({
                    data: {
                        txid,
                        type: 'Intent Sponsorship',
                        userAddress: intent.target,
                        feeAmount: intent.maxFee.toString(),
                        feeToken: resolvedFeeToken,
                        status: 'Pending',
                        network: targetNetwork,
                        userId: userId || null,
                        apiKeyId: apiKeyId || null
                    }
                });
            } catch (dbError) {
                console.error("Failed to save transaction to DB:", dbError);
            }

            return { txid, status: "sponsored" };
        } catch (error: any) {
            console.error("Relayer: Intent sponsorship error", error);
            throw error;
        }
    }

    /**
     * Item 6: Anomaly Detection — checks request rate for an API key over the last hour
     * vs the 7-day average. Auto-suspends the key if the rate is anomalously high.
     */
    private async checkAnomalyAndSuspend(apiKeyId: string): Promise<void> {
        try {
            const now = new Date();

            // Count txs in the last 7 days
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const weekCount = await (prisma.transaction as any).count({
                where: { apiKeyId, createdAt: { gte: sevenDaysAgo } }
            });

            // 7-day average hourly rate
            const avgRate = weekCount / 168;

            // Skip anomaly check for new keys with no history
            if (avgRate === 0) return;

            // Count txs in the last hour
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            const currentRate = await (prisma.transaction as any).count({
                where: { apiKeyId, createdAt: { gte: oneHourAgo } }
            });

            // Trigger only if current rate exceeds 10x average AND exceeds minimum threshold
            if (currentRate > avgRate * 10 && currentRate > 10) {
                console.warn(
                    `[Anomaly] API key ${apiKeyId} suspended: ${currentRate} req/hr vs ${avgRate.toFixed(2)} avg/hr`
                );
                await (prisma.apiKey as any).update({
                    where: { id: apiKeyId },
                    data: { status: 'Suspended' }
                });
                throw new Error('API key suspended due to unusual activity. Please contact support.');
            }
        } catch (err: any) {
            // Re-throw suspension errors; log and swallow DB/query errors
            if (err.message?.includes('suspended due to unusual activity')) throw err;
            console.warn('[Anomaly] Check failed (non-blocking):', err.message);
        }
    }

    /**
     * Sponsor a raw Stacks transaction hex
     */
    public async sponsorRawTransaction(txHex: string, apiKeyId: string, userId: string, reportedFee?: string) {
        const activeKey = userId ? this.getUserRelayerKey(userId) : this.relayerKey;
        if (!activeKey) throw new Error("Relayer key not configured");

        // Item 1: Replay protection — reject duplicate tx hex within 24 hours
        const cleanHex = txHex.replace(/^0x/, '');
        if (this.isReplay(cleanHex)) {
            throw new Error('Transaction already processed (replay detected)');
        }

        // ── Policy enforcement for DEVELOPER_SPONSORS ─────────────────────────
        // Check maxSponsoredTxsPerUser and monthlyLimitUsd before processing.
        try {
            const apiKey = await (prisma.apiKey as any).findUnique({
                where: { id: apiKeyId },
                select: {
                    sponsorshipPolicy: true,
                    maxSponsoredTxsPerUser: true,
                    monthlyLimitUsd: true,
                }
            });

            if (apiKey?.sponsorshipPolicy === 'DEVELOPER_SPONSORS') {
                // 1. Per-user tx limit
                if (apiKey.maxSponsoredTxsPerUser && apiKey.maxSponsoredTxsPerUser > 0) {
                    // Extract sender address from tx hex for per-user counting
                    let senderAddr = 'unknown';
                    try {
                        const tx = deserializeTransaction(cleanHex);
                        const auth = (tx.auth as any);
                        if (auth.originAddress) senderAddr = auth.originAddress;
                        else if (auth.spendingCondition?.signer) senderAddr = auth.spendingCondition.signer;
                    } catch {}

                    if (senderAddr !== 'unknown') {
                        const userTxCount = await (prisma.transaction as any).count({
                            where: {
                                apiKeyId,
                                userAddress: senderAddr,
                                status: { notIn: ['Failed'] }
                            }
                        });
                        if (userTxCount >= apiKey.maxSponsoredTxsPerUser) {
                            throw new Error(
                                `Sponsorship limit reached: this user has already used ${userTxCount} of ${apiKey.maxSponsoredTxsPerUser} sponsored transactions.`
                            );
                        }
                    }
                }

                // 2. Monthly USD spend limit (Item 5: use actual tx count from DB)
                if (apiKey.monthlyLimitUsd && apiKey.monthlyLimitUsd > 0) {
                    const startOfMonth = new Date();
                    startOfMonth.setDate(1);
                    startOfMonth.setHours(0, 0, 0, 0);

                    // Use actual count of non-failed txs this month for accurate spend tracking
                    const monthlyTxCount = await (prisma.transaction as any).count({
                        where: {
                            apiKeyId,
                            createdAt: { gte: startOfMonth },
                            status: { notIn: ['Failed'] }
                        }
                    });

                    // Each sponsored tx costs 0.005 STX (5000 microSTX)
                    const STX_PER_TX = 0.005;
                    const stxPrice = await this.pricingOracle.getStxPrice() || 0;
                    const actualMonthlySpendUsd = monthlyTxCount * STX_PER_TX * stxPrice;

                    if (actualMonthlySpendUsd >= apiKey.monthlyLimitUsd) {
                        throw new Error(
                            `Monthly sponsorship budget of ` USD has been reached. ` +
                            `Actual spend this month: ` USD (` txs).`
                        );
                    }
                }
            }
            }
        } catch (policyErr: any) {
            // Re-throw policy violations; log and continue for DB/config errors
            if (policyErr.message?.includes('limit') || policyErr.message?.includes('budget')) {
                throw policyErr;
            }
            console.warn('Relayer: Policy check failed (non-blocking):', policyErr.message);
        }
        // ─────────────────────────────────────────────────────────────────────


        // Item 6: Anomaly detection — auto-suspend keys with unusual traffic spikes
        await this.checkAnomalyAndSuspend(apiKeyId);
        try {
            const transaction = deserializeTransaction(cleanHex);

            // Guard: transaction MUST have AuthType.Sponsored (0x05)
            // If it's Standard (0x04), the frontend built it without sponsored:true
            // and sponsorTransaction() will throw a cryptic error.
            const authType = (transaction.auth as any).authType;
            if (authType !== 0x05) {
                throw new Error(
                    `Transaction must be constructed with sponsored:true (AuthType.Sponsored=0x05). ` +
                    `Received AuthType=0x${authType?.toString(16) ?? '??'}. ` +
                    `The wallet built a standard transaction instead of a sponsored one.`
                );
            }

            // Introspect: Try to find real address and fee
            let userAddress = 'unknown';
            let feeAmount = '0';
            let feeTokenFromTx = ''; // empty = unknown, will be skipped in USD conversion

            try {
                // Sender address: Use a more resilient way to find the signer's address
                const auth = transaction.auth as any;
                if (auth.originAddress) {
                    userAddress = auth.originAddress;
                } else if (auth.spendingCondition && auth.spendingCondition.signer) {
                    userAddress = auth.spendingCondition.signer;
                }

                // Fee Amount Introspection: Try to detect which function was called
                if (transaction.payload.payloadType === 2) { // 2 = ContractCall (matches stacks-transactions)
                    const payload = transaction.payload as any;
                    const functionName = payload.functionName;
                    const args = payload.functionArgs;

                    console.log(`Relayer: Introspecting fee for ${functionName}...`);

                    if (args && args.length > 0) {
                        let feeIndex = -1;
                        let tokenIndex = -1;

                        // execute-action-generic(executor, payload, fee-amount, relayer, fee-token)
                        //   fee-amount at index 2, fee-token at index 4
                        if (functionName === 'execute-action-generic') { feeIndex = 2; tokenIndex = 4; }
                        // simple-paymaster-v1 functions (new)
                        // swap-gasless(token-x, token-y, factor, dx, min-dy, fee-amount, relayer, fee-token)
                        //   fee-amount at index 5, fee-token at index 7
                        else if (functionName === 'swap-gasless') { feeIndex = 5; tokenIndex = 7; }
                        // swap-gasless-a(token-x, token-y, token-z, factor-x, factor-y, dx, min-dz, fee-amount, relayer, fee-token)
                        //   fee-amount at index 7, fee-token at index 9
                        else if (functionName === 'swap-gasless-a') { feeIndex = 7; tokenIndex = 9; }
                        // swap-gasless-b(token-x, token-y, token-z, token-w, factor-x, factor-y, factor-z, dx, min-dw, fee-amount, relayer, fee-token)
                        //   fee-amount at index 9, fee-token at index 11
                        else if (functionName === 'swap-gasless-b') { feeIndex = 9; tokenIndex = 11; }
                        // bridge-gasless(amount, recipient, fee-amount, relayer, fee-token)
                        //   fee-amount at index 2, fee-token at index 4
                        else if (functionName === 'bridge-gasless') { feeIndex = 2; tokenIndex = 4; }
                        // transfer-gasless(amount, recipient, memo, fee-amount, relayer, fee-token, target-token)
                        //   fee-amount at index 3, fee-token at index 5
                        else if (functionName === 'transfer-gasless') { feeIndex = 3; tokenIndex = 5; }
                        // execute-gasless(executor, payload, fee-amount, relayer, fee-token)
                        //   fee-amount at index 2, fee-token at index 4
                        else if (functionName === 'execute-gasless') { feeIndex = 2; tokenIndex = 4; }
                        // swap-velar-gasless(pool-id, t0, t1, tin, tout, dx, min-dy, fee-amount, relayer, fee-token)
                        //   fee-amount at index 7, fee-token at index 9
                        else if (functionName === 'swap-velar-gasless') { feeIndex = 7; tokenIndex = 9; }
                        // Legacy universal-paymaster-v1 functions
                        else if (functionName === 'call-gasless') { tokenIndex = 0; feeIndex = 1; }
                        else if (functionName === 'bridge-tokens') { feeIndex = 2; }
                        else if (functionName === 'swap-v1') { feeIndex = 4; }
                        else if (functionName === 'transfer-gasless-legacy' || functionName === 'transfer') { feeIndex = 3; }

                        // Extract Fee Amount
                        if (feeIndex !== -1 && args[feeIndex] && args[feeIndex].type === 1) { // 1 = uint
                            feeAmount = args[feeIndex].value.toString();
                            console.log(`Relayer: Successfully extracted fee ${feeAmount} from ${functionName}.`);
                        }

                        // Extract Fee Token
                        if (tokenIndex !== -1 && args[tokenIndex] && args[tokenIndex].type === 6) { // 6 = Principal
                            const tokenPrincipal = args[tokenIndex].value.toString();
                            feeTokenFromTx = tokenPrincipal;
                            console.log(`Relayer: Detected fee token ${tokenPrincipal} in universal call.`);
                        }
                    }
                }

                // Final Fallback: If introspection failed but SDK reported a fee, use it
                if ((feeAmount === '0' || !feeAmount) && reportedFee) {
                    feeAmount = reportedFee;
                    console.log(`Relayer: Using reportedFee fallback: ${feeAmount}`);
                }
            } catch (introError) {
                console.warn("Relayer: Failed to introspect txHex", introError);
            }

            // Detect network from transaction version
            // Property is 'transactionVersion' in @stacks/transactions 7.x
            // TransactionVersion.Mainnet = 0, TransactionVersion.Testnet = 128
            const txVersion = (transaction as any).transactionVersion ?? (transaction as any).version;
            const targetNetwork = txVersion === 0 ? 'mainnet' : 'testnet';
            const stxNetwork = targetNetwork === 'mainnet' ? this.mainnetNetwork : this.testnetNetwork;

            // Perform balance validation if a fee amount was detected
            if (feeAmount !== '0' && feeTokenFromTx && userAddress !== 'unknown') {
                const hasBalance = await this.validateUserBalance(userAddress, feeTokenFromTx, BigInt(feeAmount), targetNetwork);
                if (!hasBalance) {
                    throw new Error(`Insufficient ${feeTokenFromTx} balance in user wallet to cover the sponsorship fee.`);
                }
            }

            // Sign as sponsor
            const RELAYER_FEE = 5000n; // 0.005 STX (microSTX)

            const signedTx = await sponsorTransaction({
                transaction,
                sponsorPrivateKey: activeKey,
                network: stxNetwork,
                fee: RELAYER_FEE,
            });

            // Broadcast
            const response = await broadcastTransaction({ transaction: signedTx, network: stxNetwork });

            if ('error' in response) {
                const errorMsg = response.reason || (response as any).message || JSON.stringify(response);
                throw new Error(`Broadcast failed: ${errorMsg}`);
            }

            const txid = response.txid;

            // Item 1: Mark this tx as processed to prevent replay
            this.markProcessed(cleanHex);

            // Save to Database
            try {
                // Resolve to full principal so decimal lookup works correctly later
                const resolvedFeeToken = feeTokenFromTx
                    ? (KNOWN_TOKEN_CONTRACTS[feeTokenFromTx] || feeTokenFromTx)
                    : 'unknown';
                await (prisma.transaction as any).create({
                    data: {
                        txid: txid,
                        type: 'Native Sponsorship',
                        userAddress,
                        feeAmount,
                        feeToken: resolvedFeeToken,
                        status: 'Pending',
                        network: targetNetwork,
                        userId: userId || null,
                        apiKeyId: apiKeyId || null
                    }
                });
            } catch (e) {
                console.error("DB Save Error in sponsorRawTransaction:", e);
            }

            return {
                txid: txid,
                status: "sponsored"
            };
        } catch (error: any) {
            console.error("Native Sponsorship Error:", error);
            throw error;
        }
    }

    /**
     * Universal Sponsorship Flow:
     * 1. Sponsors an arbitrary Stacks transaction using the Project's derived Relayer Key.
     * 2. Calls the Universal Paymaster v1 contract to settle the SIP-010 fee.
     */
    public async sponsorUniversalCall(params: {
        projectId: string; // UUID from DB
        txHex: string;     // User-signed transaction
        intent: {
            user: string;
            userPubKey: string;
            token: string;
            amount: string;
            expiration: number;
            nonce: number;
            signature: string;
        };
        network?: 'mainnet' | 'testnet';
    }) {
        const { projectId, txHex, intent } = params;
        const targetNetwork = params.network || (process.env.NETWORK as 'mainnet' | 'testnet') || 'mainnet';
        const stxNetwork = targetNetwork === 'mainnet' ? this.mainnetNetwork : this.testnetNetwork;

        // 1. Derive the Project's unique Relayer Key
        const projectRelayerKey = this.getUserRelayerKey(projectId);
        const projectRelayerAddress = getAddressFromPrivateKey(projectRelayerKey, targetNetwork);

        console.log(`[Universal] Sponsoring for project ${projectId} using relayer ${projectRelayerAddress}`);

        try {
            // 2. Deserialize and Sponsor the Transaction
            const transaction = deserializeTransaction(txHex.replace(/^0x/, ''));
            
            // Check if it's already a sponsored transaction structure
            const authType = (transaction.auth as any).authType;
            if (authType !== 0x05) {
                throw new Error("Transaction must be initialized as sponsored (sponsored: true in SDK)");
            }

            // Minimal Mainnet Fee: 0.005 STX (5000 microSTX)
            const MINIMAL_FEE = 5000n;

            const signedTx = await sponsorTransaction({
                transaction,
                sponsorPrivateKey: projectRelayerKey,
                network: stxNetwork,
                fee: MINIMAL_FEE,
            });

            // 3. Broadcast
            const broadcastResponse = await broadcastTransaction({ transaction: signedTx, network: stxNetwork });
            if ('error' in broadcastResponse) {
                throw new Error(`Sponsorship broadcast failed: ${JSON.stringify(broadcastResponse)}`);
            }

            const txid = broadcastResponse.txid;
            console.log(`[Universal] Transaction sponsored: ${txid}`);

            // 4. Settlement (On-chain SIP-010 transfer)
            // The settlement is called by the Project Relayer
            // to move SIP-010 from the user's balance in the contract to the project relayer.
            await this.executeSettlement({
                projectRelayerKey,
                intent,
                txid,
                network: targetNetwork
            });

            return { txid, status: "sponsored" };
        } catch (error: any) {
            console.error("[Universal] Error:", error);
            throw error;
        }
    }

    private async executeSettlement(params: {
        projectRelayerKey: string;
        intent: any;
        txid: string;
        network: 'mainnet' | 'testnet';
    }) {
        const { projectRelayerKey, intent, txid, network } = params;
        const stxNetwork = network === 'mainnet' ? this.mainnetNetwork : this.testnetNetwork;
        
        const contractFull = this.getPaymasterAddress(network, 'v1'); 
        const [contractAddress, contractName] = contractFull.split('.');

        const txOptions = {
            contractAddress,
            contractName,
            functionName: 'settle',
            functionArgs: [
                principalCV(intent.user),
                bufferCV(Buffer.from(intent.userPubKey, 'hex')),
                principalCV(intent.token),
                uintCV(intent.amount),
                uintCV(intent.expiration),
                uintCV(intent.nonce),
                bufferCV(Buffer.from(intent.signature, 'hex')),
                bufferCV(Buffer.from(txid.replace(/^0x/, ''), 'hex'))
            ],
            senderKey: projectRelayerKey, // The project's relayer address calls this to get paid
            network: stxNetwork,
            anchorMode: AnchorMode.Any,
            postConditionMode: PostConditionMode.Allow,
        };

        try {
            const transaction = await makeContractCall(txOptions);
            const response = await broadcastTransaction({ transaction, network: stxNetwork });
            console.log(`[Settlement] Settlement broadcasted for ${txid}: ${JSON.stringify(response)}`);
        } catch (error) {
            console.error("[Settlement] Failed:", error);
        }
    }
}
