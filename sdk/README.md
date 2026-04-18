# @velumx/sdk

> Universal Gasless transaction SDK for Stacks — Pay fees in sBTC, ALEX, or any SIP-010 token.

---

## Installation

```bash
npm install @velumx/sdk
```

## Quick Start (Relayer v1 Architecture)

### 1. Initialize Client
Initialize the client with your **API Key** from the VelumX Dashboard.

```typescript
import { VelumXClient } from '@velumx/sdk';

const velumx = new VelumXClient({
  apiKey: 'YOUR_PROJECT_KEY',
  network: 'mainnet'
});
```

#### Agnostic Universal Execution (Relayer v1 Executor Pattern)
VelumX Relayer v1 uses a completely universal executor pattern. You do not need an on-chain registry. Simply deploy a small executor template for your target protocol (or use an existing one), pack your payload buffer, and call `getExecuteGenericOptions`.

```typescript
import { tupleCV, principalCV, uintCV, serializeCV } from '@stacks/transactions';

// Example: Packing a generic buffer for an executor
const payloadCv = tupleCV({
  'router': principalCV('SP...router-address'),
  'amount': uintCV(1000000)
});
const serializedPayload = serializeCV(payloadCv);

const options = velumx.getExecuteGenericOptions({
  executor: 'SP...your-dapp-executor',
  payload: serializedPayload, // The packed Uint8Array
  feeToken: 'sBTC',
  feeAmount: 100,
  relayer: 'SP...developer-relayer',
  version: 'relayer-v1'
});

await openContractCall(options);
```



## API Reference

### VelumXClient

#### Methods

##### `.estimateFee(options)`
Get a real-time fee estimation based on current market rates and relayer overhead.

##### `.getExecuteGenericOptions(params)`
Generates options for the `execute-action-generic` handler in `velumx-relayer-1`.

## Executor Contracts
To use the Universal Executor, you simply deploy an executor contract that implements the `velumx-executor-trait`. You **do not** need to register anything on-chain. All configuration (supported tokens, API keys) is handled by your VelumX dashboard account!

---

### Relayer v1 (Latest)
- 🌍 **Universal Executor (Relayer v1)**: 100% universal support for ANY protocol without upgrading the core paymaster.
- 🔒 **Clarity 4 Security**: Uses `restrict-assets?` to guarantee safe execution of custom developer traits.
- 🚀 **Zero Admin On-Chain**: The on-chain registry has been completely removed. Backend handles all logic.

Built with ❤️ by the VelumX team
