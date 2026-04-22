# @velumx/sdk

> Relayer-as-a-Service SDK for Stacks — sponsor any transaction, pay fees in any SIP-010 token.

---

## Overview

VelumX is a Relayer-as-a-Service (RaaS) platform. The SDK gives you one method that matters: `velumx.sponsor(signedTxHex)`. VelumX handles all the relayer infrastructure — STX balance management, key derivation, nonce management, broadcast.

**You build the transaction. VelumX sponsors it.**

---

## Installation

```bash
npm install @velumx/sdk
```

---

## Quick Start

### 1. Get your API key

Log in to the [VelumX Dashboard](https://dashboard.velumx.xyz), create a project, and fund your relayer address with STX.

### 2. Set up a secure proxy

Your API key must never be in client-side code. Create a server-side proxy:

```typescript
// app/api/velumx/[...path]/route.ts (Next.js)
export async function POST(req: Request, { params }: { params: { path: string[] } }) {
  const response = await fetch(`https://api.velumx.xyz/api/v1/${params.path.join('/')}`, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.VELUMX_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: await req.text(),
  });
  return Response.json(await response.json());
}
```

### 3. Initialize the client

```typescript
import { VelumXClient } from '@velumx/sdk';

const velumx = new VelumXClient({
  paymasterUrl: '/api/velumx/proxy', // your secure proxy
  network: 'mainnet',
});
```

---

## DEVELOPER_SPONSORS — Simplest Integration

The developer's relayer pays STX gas. Users pay nothing. No paymaster contract needed.

```typescript
import { VelumXClient, buildSponsoredContractCall } from '@velumx/sdk';
import { uintCV } from '@stacks/transactions';
import { request } from '@stacks/connect';

const velumx = new VelumXClient({ paymasterUrl: '/api/velumx/proxy', network: 'mainnet' });

// 1. Build any contract call as a sponsored transaction
const unsignedTx = await buildSponsoredContractCall({
  contractAddress: 'SPQC38PW542EQJ5M11CR25P7BS1CA6QT4TBXGB3M',
  contractName: 'stableswap-stx-ststx-v-1-2',
  functionName: 'swap-x-for-y',
  functionArgs: [uintCV(1n), tokenXCV, tokenYCV, uintCV(1_000_000n), uintCV(990_000n)],
  publicKey: userPublicKey,
});

// 2. User signs (no broadcast)
const signResult = await request('stx_signTransaction', {
  transaction: unsignedTx,
  broadcast: false,
});

// 3. VelumX relayer co-signs and broadcasts
const { txid } = await velumx.sponsor(signResult.transaction);
console.log('txid:', txid);
```

---

## USER_PAYS — Fee Collected in SIP-010 Token

The user pays a token fee. You need a paymaster contract that atomically collects the fee and executes the action. Deploy your own (copy the [VelumX DeFi reference paymaster](https://github.com/velumx/contracts) as a template).

```typescript
// 1. Estimate fee
const estimate = await velumx.estimateFee({
  feeToken: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.aeusdc',
  estimatedGas: 200_000,
});

// 2. Build call to your paymaster contract
const unsignedTx = await buildSponsoredContractCall({
  contractAddress: 'SP...your-paymaster',
  contractName: 'my-paymaster-v1',
  functionName: 'swap-with-fee',
  functionArgs: [
    /* swap params */,
    uintCV(BigInt(estimate.maxFee)),
    principalCV(estimate.relayerAddress),
    /* fee-token trait */,
  ],
  publicKey: userPublicKey,
});

// 3. User signs
const signResult = await request('stx_signTransaction', {
  transaction: unsignedTx,
  broadcast: false,
});

// 4. Sponsor with fee params
const { txid } = await velumx.sponsor(signResult.transaction, {
  feeToken: estimate.feeToken,
  feeAmount: estimate.maxFee,
});
```

---

## API Reference

### `new VelumXClient(config)`

| Option | Type | Description |
| :--- | :--- | :--- |
| `paymasterUrl` | `string` | URL of your secure backend proxy |
| `network` | `'mainnet' \| 'testnet'` | Stacks network |

---

### `velumx.sponsor(signedTxHex, options?)`

The primary method. Submits a signed sponsored transaction to the VelumX relayer.

```typescript
const { txid } = await velumx.sponsor(signedTxHex, {
  feeToken: 'SP...aeusdc',  // omit for DEVELOPER_SPONSORS
  feeAmount: '250000',       // omit for DEVELOPER_SPONSORS
  network: 'mainnet',
});
```

Throws `RelayerError` if the relayer rejects the transaction.

---

### `velumx.estimateFee(params)`

Returns a real-time fee estimate in the chosen SIP-010 token.

```typescript
const estimate = await velumx.estimateFee({
  feeToken: 'SP...aeusdc',
  estimatedGas: 150_000,
});
// { maxFee: string, feeToken: string, policy: 'DEVELOPER_SPONSORS' | 'USER_PAYS', relayerAddress: string }
```

---

### `buildSponsoredContractCall(params)`

Builds an unsigned sponsored `ContractCall` transaction ready for wallet signing.

```typescript
const unsignedTx = await buildSponsoredContractCall({
  contractAddress: string,
  contractName: string,
  functionName: string,
  functionArgs: ClarityValue[],
  publicKey: string,       // user's Stacks public key
  nonce?: bigint,          // auto-fetched if omitted
  network?: 'mainnet' | 'testnet',
});
// Returns: Uint8Array (serialized unsigned sponsored tx)
```

---

## Types

```typescript
interface SponsorOptions {
  feeToken?: string;
  feeAmount?: string;
  network?: 'mainnet' | 'testnet';
}

interface FeeEstimateResult {
  maxFee: string;
  feeToken: string;
  policy: 'DEVELOPER_SPONSORS' | 'USER_PAYS';
  relayerAddress: string;
}

interface SponsorResult {
  txid: string;
}

class RelayerError extends Error {
  reason: string;
}
```

---

## How It Works

```
User signs sponsored tx (no STX needed)
        ↓
velumx.sponsor(signedTxHex)
        ↓
Your secure proxy (injects API key)
        ↓
VelumX Relayer (validates API key, co-signs, broadcasts)
        ↓
Stacks Network
```

The API key is the only gate. Rate limits, spending caps, and token policies are enforced server-side per API key.

---

Built with ❤️ by the VelumX team
