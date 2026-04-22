/**
 * @velumx/sdk
 *
 * Relayer-as-a-Service SDK for Stacks.
 * You build the transaction — VelumX sponsors the STX gas fee.
 *
 * Quick start (DEVELOPER_SPONSORS — user pays nothing):
 * ```ts
 * import { VelumXClient, buildSponsoredContractCall } from '@velumx/sdk';
 * import { request } from '@stacks/connect';
 *
 * const velumx = new VelumXClient({
 *   paymasterUrl: '/api/velumx/proxy',
 *   network: 'mainnet',
 * });
 *
 * // 1. Build any contract call as a sponsored transaction
 * const unsignedTx = await buildSponsoredContractCall({
 *   contractAddress: 'SP...',
 *   contractName: 'my-contract',
 *   functionName: 'my-function',
 *   functionArgs: [...],
 *   publicKey: userPublicKey,
 * });
 *
 * // 2. User signs (no broadcast)
 * const signResult = await request('stx_signTransaction', {
 *   transaction: unsignedTx,
 *   broadcast: false,
 * });
 *
 * // 3. VelumX relayer co-signs and broadcasts
 * const { txid } = await velumx.sponsor(signResult.transaction);
 * ```
 *
 * Quick start (USER_PAYS — user pays fee in SIP-010 token):
 * ```ts
 * const estimate = await velumx.estimateFee({
 *   feeToken: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.aeusdc',
 * });
 *
 * // Build call to your paymaster contract
 * const unsignedTx = await buildSponsoredContractCall({
 *   contractAddress: 'SP...your-paymaster',
 *   contractName: 'my-paymaster-v1',
 *   functionName: 'swap-with-fee',
 *   functionArgs: [..., uintCV(BigInt(estimate.maxFee)), principalCV(estimate.relayerAddress!)],
 *   publicKey: userPublicKey,
 * });
 *
 * const signResult = await request('stx_signTransaction', {
 *   transaction: unsignedTx,
 *   broadcast: false,
 * });
 *
 * const { txid } = await velumx.sponsor(signResult.transaction, {
 *   feeToken: estimate.feeToken,
 *   feeAmount: estimate.maxFee,
 * });
 * ```
 */

export { VelumXClient, buildSponsoredContractCall } from './VelumXClient';
export type {
    NetworkConfig,
    SponsorOptions,
    FeeEstimateResult,
    SponsorResult,
    ContractCallParams,
} from './types';
export { RelayerError } from './types';
