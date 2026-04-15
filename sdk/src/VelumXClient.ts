import { uintCV, principalCV, bufferCV, someCV, noneCV, Cl } from '@stacks/transactions';
import { NetworkConfig, SponsorshipOptions, FeeEstimateResult, SponsorResult } from './types';

/**
 * VelumXClient — The core SDK for integrating VelumX gasless sponsorship.
 */
export class VelumXClient {
    private config: NetworkConfig;
    private relayerUrl: string;

    constructor(config: NetworkConfig) {
        if (!config.apiKey && !config.paymasterUrl?.includes('/api/velumx/proxy')) {
            throw new Error(
                'VelumX: API Key is required. Get yours at the VelumX Developer Dashboard.'
            );
        }
        this.config = config;
        this.relayerUrl = config.paymasterUrl || 'https://api.velumx.xyz/api/v1';
    }

    /**
     * Estimate the gas fee for a transaction in a specific SIP-010 token.
     */
    public async estimateFee(params: {
        feeToken: string;
        estimatedGas?: number;
    }): Promise<FeeEstimateResult> {
        const { feeToken, estimatedGas = 150000 } = params;

        const response = await fetch(`${this.relayerUrl}/estimate`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({
                intent: {
                    feeToken,
                    estimatedGas,
                    network: this.config.network
                }
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: response.statusText })) as any;
            throw new Error(`Fee estimation failed: ${err.error || err.message || response.statusText}`);
        }

        return response.json() as Promise<FeeEstimateResult>;
    }

    /**
     * Sponsor a signed Stacks transaction — the relayer pays the STX network fee.
     */
    public async sponsor(txHex: string, options?: SponsorshipOptions): Promise<SponsorResult> {
        const response = await fetch(`${this.relayerUrl}/broadcast`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({
                txHex,
                feeToken: options?.feeToken,
                feeAmount: options?.feeAmount,
                userId: options?.userId,
                network: options?.network || this.config.network
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: response.statusText })) as any;
            throw new Error(`Sponsorship failed: ${err.error || err.message || response.statusText}`);
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
            headers: this.headers()
        });

        if (!response.ok) {
            return { supportedGasTokens: [], sponsorshipPolicy: 'USER_PAYS' };
        }

        return response.json();
    }

    /**
     * Get the ContractCall options for a Velar Swap via the VelumX Paymaster.
     * Use this with @stacks/connect's openContractCall().
     */
    public getVelarSwapOptions(params: {
        poolId: number;
        token0: string;
        token1: string;
        tokenIn: string;
        tokenOut: string;
        dx: string | number;
        minDy: string | number;
        feeAmount: string | number;
        feeToken: string;
        relayer: string;
    }) {
        const paymaster = this.getPaymasterAddress(this.config.network);
        const [contractAddress, contractName] = paymaster.split('.');

        return {
            contractAddress,
            contractName,
            functionName: 'swap-velar-gasless',
            functionArgs: [
                uintCV(params.poolId),
                principalCV(params.token0),
                principalCV(params.token1),
                principalCV(params.tokenIn),
                principalCV(params.tokenOut),
                uintCV(params.dx),
                uintCV(params.minDy),
                uintCV(params.feeAmount),
                principalCV(params.relayer),
                principalCV(params.feeToken)
            ],
            sponsored: true,
            network: this.config.network
        };
    }

    /**
     * Get the ContractCall options for an ALEX Swap via the VelumX Paymaster.
     * Supports ALEX amm-pool-v2-01.
     */
    public getAlexSwapOptions(params: {
        tokenX: string;
        tokenY: string;
        factor: string | number;
        dx: string | number;
        minDy?: string | number;
        feeAmount: string | number;
        feeToken: string;
        relayer: string;
    }) {
        const paymaster = this.getPaymasterAddress(this.config.network);
        const [contractAddress, contractName] = paymaster.split('.');

        return {
            contractAddress,
            contractName,
            functionName: 'swap-gasless',
            functionArgs: [
                principalCV(params.tokenX),
                principalCV(params.tokenY),
                uintCV(params.factor),
                uintCV(params.dx),
                params.minDy ? someCV(uintCV(params.minDy)) : noneCV(),
                uintCV(params.feeAmount),
                principalCV(params.relayer),
                principalCV(params.feeToken)
            ],
            sponsored: true,
            network: this.config.network
        };
    }

    /**
     * Get the ContractCall options for a Universal Action via the VelumX Paymaster v5.
     * Use this with @stacks/connect's openContractCall().
     */
    public getExecuteGenericOptions(params: {
        projectId: string;
        actionId: string;
        executor: string;
        payload: string;
        feeAmount: string | number;
        feeToken: string;
        version?: 'v4' | 'v5';
    }) {
        const paymaster = this.getPaymasterAddress(this.config.network, params.version || 'v5');
        const [contractAddress, contractName] = paymaster.split('.');

        return {
            contractAddress,
            contractName,
            functionName: 'execute-action-generic',
            functionArgs: [
                principalCV(params.projectId),
                Cl.stringAscii(params.actionId),
                principalCV(params.executor),
                bufferCV(Buffer.from(params.payload.replace(/^0x/, ''), 'hex')),
                uintCV(params.feeAmount),
                principalCV(params.feeToken)
            ],
            sponsored: true,
            network: this.config.network
        };
    }

    /**
     * Get the ContractCall options for a Universal Action via a developer's Adapter (Legacy v4).
     */
    public getExecuteOptions(params: {
        executor: string;
        payload: string;
        feeAmount: string | number;
        feeToken: string;
        relayer: string;
    }) {
        const paymaster = this.getPaymasterAddress(this.config.network, 'v4');
        const [contractAddress, contractName] = paymaster.split('.');

        return {
            contractAddress,
            contractName,
            functionName: 'execute-gasless',
            functionArgs: [
                principalCV(params.executor),
                bufferCV(Buffer.from(params.payload.replace(/^0x/, ''), 'hex')),
                uintCV(params.feeAmount),
                principalCV(params.relayer),
                principalCV(params.feeToken)
            ],
            sponsored: true,
            network: this.config.network
        };
    }

    /**
     * Internal: Get the Paymaster address for the target network.
     */
    private getPaymasterAddress(network: 'mainnet' | 'testnet', version: 'v4' | 'v5' = 'v5'): string {
        if (network === 'mainnet') {
            if (version === 'v4') return 'SPKYNF473GQ1V0WWCF24TV7ZR1WYAKTC7AM8QGBW.simple-paymaster-v4';
            return 'SPKYNF473GQ1V0WWCF24TV7ZR1WYAKTC7AM8QGBW.universal-paymaster-v5';
        }
        if (version === 'v4') return 'STKYNF473GQ1V0WWCF24TV7ZR1WYAKTC79V25E3P.simple-paymaster-v4';
        return 'STKYNF473GQ1V0WWCF24TV7ZR1WYAKTC79V25E3P.universal-paymaster-v5';
    }

    private headers(): Record<string, string> {
        const h: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.config.apiKey && this.config.apiKey !== 'proxied') {
            h['x-api-key'] = this.config.apiKey;
        }
        return h;
    }
}
