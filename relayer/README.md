# VelumX Relayer (v1 Architecture)

> The core sponsorship engine for the VelumX platform. A multi-tenant, high-performance service that enables gasless transactions on Stacks with native Relayer v1 introspection and Clarity 4 security.

---

## Relayer v1 Introspection Engine

The VelumX Relayer includes advanced introspection logic for the **Relayer v1 Universal Paymaster**. It automatically extracts sponsorship data from raw transactions:

- 🌍 **Universal Execution Introspection**: Introspecting `execute-action-generic` payloads to support any custom developer-registered adapter without hardcoding protocol logic.
- 💰 **Relayer Payouts**: Ensuring all fees collected via `USER_PAYS` are routed to the developer's unique relayer address derived from their API key.
- 🚀 **Zero On-Chain Registry**: The Relayer completely eliminates the need for an on-chain registry, determining token support and fee caps dynamically from the VelumX database.

## API Reference (Relayer v1)

### `POST /api/v1/broadcast`
Broadcasts and sponsors a raw Stacks transaction. Relayer v1 introspection will automatically override `feeAmount` if protocol-specific data is found in the `execute-action-generic` contract call.

**Body:**
```json
{
  "txHex": "0x...",
  "userId": "optional-custom-id"
}
```

### `GET /api/dashboard/stats`
Returns real-time analytics for the authenticated developer, now including split metrics for Velar vs. Custom Executor actions.

## Environment Variables (Relayer v1 Config)

| Variable | Description | Default |
|----------|-------------|---------|
| `PAYMASTER_RELAYER_V1_MAINNET` | Relayer v1 Principal on Mainnet | `SP...velumx-relayer-1` |
| `PAYMASTER_RELAYER_V1_TESTNET` | Relayer v1 Principal on Testnet | `ST...velumx-relayer-1` |
| `RELAYER_KEY` | Primary relayer private key | Required |
| `NETWORK` | Stacks network (`mainnet` or `testnet`) | `testnet` |

## Local Development

```bash
npm install
npx prisma generate
npm run dev
```

---

### Relayer v1 Changes
- ✅ **Relayer v1 Protocol Introspection**: Support for universal execution across all protocols.
- 💎 **Universal Sponsorship** - Supports any SIP-010 token for gas fees via a traits-based paymaster.
- ⚡ **Zero-Admin Registry** - Removes the bottleneck of registering contracts and tokens on-chain.
- 🏢 **Multi-Tenant Architecture** - Segregated API keys and relayer wallets for different developers/dApps.

Built with ❤️ by the VelumX team
