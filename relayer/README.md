# VelumX Relayer (v4.0.0)

> The core sponsorship engine for the VelumX platform. A multi-tenant, high-performance service that enables gasless transactions on Stacks with native v4 introspection.

---

## v4 Introspection Engine

The VelumX Relayer now includes advanced introspection logic for the **v4 Universal Paymaster**. It automatically extracts sponsorship data from raw transactions for:

- ⚡ **Native Velar Swaps**: Detecting `swap-velar-gasless` calls to calculate accurate sBTC/ALEX/USDC fees.
- 🌍 **Agnostic Universal Execution**: Introspecting `execute-gasless` payloads to support custom developer-registered adapters.
- 💰 **Relayer Payouts**: Ensuring all fees collected via `USER_PAYS` are routed to the developer's unique relayer address derived from their API key.

## API Reference (v4)

### `POST /api/v1/broadcast`
Broadcasts and sponsors a raw Stacks transaction. v4 introspection will automatically override `feeAmount` if protocol-specific data is found in the contract call.

**Body:**
```json
{
  "txHex": "0x...",
  "userId": "optional-custom-id"
}
```

### `GET /api/dashboard/stats`
Returns real-time analytics for the authenticated developer, now including split metrics for Velar vs. Custom Executor actions.

## Environment Variables (v4 Config)

| Variable | Description | Default |
|----------|-------------|---------|
| `PAYMASTER_CONTRACT_MAINNET` | v4 Principal on Mainnet | `SP...-v4` |
| `PAYMASTER_CONTRACT_TESTNET` | v4 Principal on Testnet | `ST...-v4` |
| `RELAYER_KEY` | Primary relayer private key | Required |
| `NETWORK` | Stacks network (`mainnet` or `testnet`) | `testnet` |

## Local Development

```bash
npm install
npx prisma generate
npm run dev
```

---

### v4.0.0 Changes
- ✅ **v4 Protocol Introspection**: Support for native Velar and Agnostic execution.
- 💎 **Universal Sponsorship** - Supports any SIP-010 token for gas fees via a traits-based paymaster.
- ⚡ **Native Protocol Introspection** - Automatically extracts user addresses and fee data from native **Velar** and **ALEX** swap transactions.
- 🏢 **Multi-Tenant Architecture** - Segregated API keys and relayer wallets for different developers/dApps.

Built with ❤️ by the VelumX team
