# @velumx/sdk

> Universal Gasless transaction SDK for Stacks — Pay fees in sBTC, ALEX, or any SIP-010 token.

---

## Installation

```bash
npm install @velumx/sdk
```

## Quick Start (v4.0.0)

### 1. Initialize Client
Initialize the client with your **Project Key** from the VelumX Dashboard.

```typescript
import { VelumXClient } from '@velumx/sdk';

const velumx = new VelumXClient({
  apiKey: 'YOUR_PROJECT_KEY',
  network: 'mainnet'
});
```

### 2. Standardized Protocol Helpers
VelumX v4 provides high-level helpers that generate contract-call options for specific protocols.

#### Velar Swap
```typescript
const options = velumx.getVelarSwapOptions({
  poolId: 1,
  tokenIn: 'USDC',
  tokenOut: 'STX',
  dx: 1000000,
  minDy: 980000,
  feeToken: 'ALEX',
  feeAmount: 50,
  relayer: 'SP...developer-relayer'
});

await openContractCall(options);
```

#### ALEX Swap
```typescript
const options = velumx.getAlexSwapOptions({
  tokenX: 'ALEX',
  tokenY: 'STX',
  factor: 100000000,
  dx: 1000,
  minDy: 950,
  feeToken: 'USDC',
  feeAmount: 1,
  relayer: 'SP...developer-relayer'
});

await openContractCall(options);
```

#### Agnostic Universal Execution (Custom Adapters)
If you have registered an **Adapter** on the VelumX Dashboard, you can execute its logic gaslessly:

```typescript
const options = velumx.getExecuteOptions({
  executor: 'SP...your-dapp-adapter',
  payload: '0x01abc...', // Your encoded Clarity logic
  feeToken: 'sBTC',
  feeAmount: 100,
  relayer: 'SP...developer-relayer'
});

await openContractCall(options);
```

## API Reference

### VelumXClient

#### Methods

##### `.estimateFee(options)`
Get a real-time fee estimation based on current market rates and relayer overhead.

##### `.getVelarSwapOptions(params)`
Generates options for the `swap-velar-gasless` protocol call.

##### `.getExecuteOptions(params)`
Generates options for the `execute-gasless` agnostic handler.

## Adapter Registration
To use the Universal Executor, you must register your contract principal as an **Adapter** in the VelumX Dashboard. This ensures the dashboard can track your dApp's specific logic and metrics.

---

### v4.0.0 (Latest)
- 🌍 **Agnostic Executor**: Full support for custom dApp logic via registered Adapters.
- ⚡ **Native Velar**: Direct integration for high-performance Velar swaps.
- 🔧 **Pimlico Helpers**: Simplified `getOptions` methods for common tasks.
- 🔒 **Secured Payloads**: Improved payload versioning for future-proof upgrades.

Built with ❤️ by the VelumX team
