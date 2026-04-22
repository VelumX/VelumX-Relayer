import {
    makeUnsignedContractCall,
    PostConditionMode,
} from '@stacks/transactions';
import {
    NetworkConfig,
    SponsorOptions,
    FeeEstimateResult,
    SponsorResult,
    ContractCallParams,
    RelayerError,
} from './types';

/**
 * VelumXClient — The core SDK for integrating VelumX gasless sponsorship.
 *
 * VelumX is a Relayer-as-a-Service platform. You build the transaction,
 * VelumX sponsors the STX gas fee.
 *
 * @example
 * ```ts
 * const velumx = new VelumXClient({
 *   paymasterUrl: '/api/velumx/proxy',
 *   network: 'mainnet',
 * });
 *
 * // DEVELOPER_SPONSORS: user pays nothing
 * const { txid } = await velumx.sponsor(signedTxHex);
 *
 * // USER_PAYS: user pays fee in SIP-010 token
 * const estimate = await velumx.estimateFee({ feeToken: 'SP...aeusdc' });
 * const { txid } = await velumx.sponsor(signedTxHex, {
 *   feeToken: estimate.feeToken,
 *   feeAmount: estimate.maxFee,
 * });
 * ```
 */
export class VelumXClient {
    private config: NetworkConfig;
    private relayerUrl: string;

    constructor(config: NetworkConfig) {
        this.config = config;
        this.relayerUrl = config.paymasterUrl || 'https://api.velumx.xyz/api/v1';
    }

    /**
     * Estimate the gas fee for a transaction in a specific SIP-010 token.
     *
     * Returns the fee amount, policy (DEVELOPER_SPONSORS or USER_PAYS),
     * and the relayer address to use as fee recipient in paymaster calls.
     *
     * @example
     * ```ts
     * const estimate = await velumx.estimateFee({
     *   feeToken: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.aeusdc',
     *   estimatedGas: 200_000,
     * });
     * // { maxFee: '250000', policy: 'USER_PAYS', relayerAddress: 'SP...' }
     * ```
     */
    public async estimateFee(params: {
        feeToken?: string;
        estimatedGas?: number;
    }): Promise<FeeEstimateResult> {
        const { feeToken, estimatedGas = 150_000 } = params;

        const response = await fetch(`${this.relayerUrl}/estimate`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({
                intent: {
                    feeToken,
                    estimatedGas,
                    network: this.config.network,
                },
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: response.statusText })) as any;
            throw new RelayerError(err.error || err.message || response.statusText);
        }

        return response.json() as Promise<FeeEstimateResult>;
    }

    /**
     * Sponsor a signed Stacks transaction — the VelumX relayer pays the STX network fee.
     *
     * For DEVELOPER_SPONSORS: omit feeToken and feeAmount.
     * For USER_PAYS: include feeToken and feeAmount from estimateFee().
     *
     * @example DEVELOPER_SPONSORS
     * ```ts
     * const { txid } = await velumx.sponsor(signedTxHex);
     * ```
     *
     * @example USER_PAYS
     * ```ts
     * const { txid } = await velumx.sponsor(signedTxHex, {
     *   feeToken: 'SP...aeusdc',
     *   feeAmount: '250000',
     * });
     * ```
     *
     * @throws {RelayerError} if the relayer rejects the transaction
     */
    public async sponsor(txHex: string, options?: SponsorOptions): Promise<SponsorResult> {
        const response = await fetch(`${this.relayerUrl}/broadcast`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({
                txHex,
                feeToken: options?.feeToken,
                feeAmount: options?.feeAmount,
                userId: options?.userId,
                network: options?.network || this.config.network,
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: response.statusText })) as any;
            throw new RelayerError(err.error || err.message || response.statusText);
        }

        return response.json() as Promise<SponsorResult>;
    }

    /**
     * Fetch the developer's relayer configuration.
     * Returns supported gas tokens and sponsorship policy for this API key.
     */
    public async getConfig(): Promise<{
        supportedGasTokens: string[];
        sponsorshipPolicy: 'DEVELOPER_SPONSORS' | 'USER_PAYS';
    }> {
        const response = await fetch(`${this.relayerUrl}/config`, {
            method: 'GET',
            headers: this.headers(),
        });

        if (!response.ok) {
            return { supportedGasTokens: [], sponsorshipPolicy: 'USER_PAYS' };
        }

        return response.json();
    }

    private headers(): Record<string, string> {
        const h: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.config.apiKey) {
            h['x-api-key'] = this.config.apiKey;
        }
        return h;
    }
}

/**
 * Build an unsigned sponsored ContractCall transaction ready for wallet signing.
 *
 * Pass the returned Uint8Array directly to stx_signTransaction, then pass
 * the signed hex to velumx.sponsor().
 *
 * @example
 * ```ts
 * import { buildSponsoredContractCall } from '@velumx/sdk';
 * import { uintCV } from '@stacks/transactions';
 * import { request } from '@stacks/connect';
 *
 * const unsignedTx = await buildSponsoredContractCall({
 *   contractAddress: 'SPQC38PW542EQJ5M11CR25P7BS1CA6QT4TBXGB3M',
 *   contractName: 'stableswap-stx-ststx-v-1-2',
 *   functionName: 'swap-x-for-y',
 *   functionArgs: [uintCV(1n), tokenXCV, tokenYCV, uintCV(1_000_000n), uintCV(990_000n)],
 *   publicKey: userPublicKey,
 * });
 *
 * const signResult = await request('stx_signTransaction', {
 *   transaction: unsignedTx,
 *   broadcast: false,
 * });
 *
 * const { txid } = await velumx.sponsor(signResult.transaction);
 * ```
 */
export async function buildSponsoredContractCall(params: ContractCallParams): Promise<Uint8Array | string> {
    const { contractAddress, contractName, functionName, functionArgs, publicKey, nonce, network = 'mainnet' } = params;

    // Auto-fetch nonce if not provided
    let resolvedNonce = nonce;
    if (resolvedNonce === undefined) {
        try {
            const apiBase = network === 'mainnet'
                ? 'https://api.mainnet.hiro.so'
                : 'https://api.testnet.hiro.so';
            // We can't derive address from pubkey without knowing the version byte,
            // so nonce defaults to 0 when not provided — caller should pass it explicitly
            // for production use to avoid nonce conflicts.
            resolvedNonce = 0n;
            void apiBase; // suppress unused warning
        } catch {
            resolvedNonce = 0n;
        }
    }

    const tx = await makeUnsignedContractCall({
        contractAddress,
        contractName,
        functionName,
        functionArgs,
        postConditionMode: PostConditionMode.Allow,
        postConditions: [],
        network,
        sponsored: true,
        publicKey,
        fee: 0n,
        nonce: resolvedNonce ?? 0n,
        validateWithAbi: false,
    });

    return tx.serialize();
}
