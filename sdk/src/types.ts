/**
 * VelumX SDK Types
 *
 * VelumX is a Relayer-as-a-Service platform for Stacks.
 * Developers build their own transactions — VelumX sponsors the STX gas fee.
 */

import { ClarityValue } from '@stacks/transactions';

/**
 * Configuration for VelumXClient
 */
export interface NetworkConfig {
    /** Stacks network: 'mainnet' | 'testnet' */
    network: 'mainnet' | 'testnet';
    /**
     * URL of your secure backend proxy that injects the API key.
     * Example: '/api/velumx/proxy'
     * Defaults to 'https://api.velumx.xyz/api/v1' (requires apiKey to be set)
     */
    paymasterUrl?: string;
    /** Your VelumX API key from the Developer Dashboard (server-side only) */
    apiKey?: string;
}

/**
 * Parameters for building a sponsored contract call transaction.
 * Pass the result to stx_signTransaction, then to velumx.sponsor().
 */
export interface ContractCallParams {
    /** Contract deployer address */
    contractAddress: string;
    /** Contract name */
    contractName: string;
    /** Function to call */
    functionName: string;
    /** Clarity function arguments */
    functionArgs: ClarityValue[];
    /** User's Stacks public key (hex) */
    publicKey: string;    /** Transaction nonce — auto-fetched from Stacks API if omitted */
    nonce?: bigint;
    /** Network override — defaults to client network */
    network?: 'mainnet' | 'testnet';
}

/**
 * Options passed when sponsoring a transaction via velumx.sponsor()
 */
export interface SponsorOptions {
    /**
     * SIP-010 token contract principal the user pays the fee with.
     * e.g. 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.aeusdc'
     * Omit for DEVELOPER_SPONSORS policy (user pays nothing).
     */
    feeToken?: string;
    /**
     * Fee amount in micro-units of feeToken (from estimateFee response).
     * Omit for DEVELOPER_SPONSORS policy.
     */
    feeAmount?: string;
    /** Optional user identifier for multi-tenant tracking */
    userId?: string;
    /** Network override — defaults to client network */
    network?: 'mainnet' | 'testnet';
}

/**
 * Response from velumx.estimateFee()
 */
export interface FeeEstimateResult {
    /** Fee amount in micro-units of feeToken. "0" when DEVELOPER_SPONSORS. */
    maxFee: string;
    /** The fee token contract principal */
    feeToken: string;
    /** Estimated gas units used for calculation */
    estimatedGas: number;
    /** Sponsorship policy for this API key */
    policy: 'DEVELOPER_SPONSORS' | 'USER_PAYS';
    /** USD value of the fee — for display purposes */
    maxFeeUsd?: string;
    /** Developer's relayer STX address — use as fee recipient in paymaster calls */
    relayerAddress?: string;
}

/**
 * Response from velumx.sponsor()
 */
export interface SponsorResult {
    /** Stacks transaction ID */
    txid: string;
    /** Transaction status */
    status: string;
}

/**
 * Error thrown when the VelumX relayer rejects a transaction
 */
export class RelayerError extends Error {
    public readonly reason: string;

    constructor(reason: string) {
        super(`VelumX RelayerError: ${reason}`);
        this.name = 'RelayerError';
        this.reason = reason;
    }
}
