# VelumX Relayer

> The sponsorship engine for the VelumX RaaS platform. A multi-tenant Node.js service that co-signs and broadcasts sponsored Stacks transactions on behalf of developers.

---

## Overview

The VelumX Relayer is the core infrastructure product. Developers integrate gasless transactions by calling `velumx.sponsor(signedTxHex)` from the SDK — the relayer handles everything else.

**What the relayer does:**
- Validates the developer's API key
- Co-signs the sponsored transaction as the STX fee-payer
- Manages STX balances per developer (multi-tenant key derivation)
- Broadcasts to the Stacks network
- Enforces rate limits and spending caps per API key
- Logs all transactions for the developer dashboard

**What the relayer does NOT do:**
- Inspect or validate what contract is being called
- Maintain an on-chain registry or whitelist
- Require developers to register executors or tokens on-chain

The API key is the only gate. All policy (token whitelist, fee caps, rate limits) is enforced server-side.

---

## Architecture

```
Developer's dApp
      ↓
@velumx/sdk → velumx.sponsor(signedTxHex)
      ↓
Developer's Secure Proxy (injects API key)
      ↓
VelumX Relayer API
      ↓  validate API key
      ↓  derive developer's relayer key (HD path from master key)
      ↓  co-sign as fee-payer
      ↓  broadcast to Stacks
Stacks Network
```

### Multi-Tenant Key Derivation

Every developer gets a unique relayer address derived from a master key using HD path derivation. Funds are fully isolated — one developer's STX balance cannot affect another's.

---

## API Reference

### `POST /api/v1/sponsor`

Co-signs and broadcasts a signed sponsored transaction.

**Headers:**
```
x-api-key: YOUR_API_KEY
Content-Type: application/json
```

**Body:**
```json
{
  "txHex": "0x...",
  "feeToken": "SP...aeusdc",
  "feeAmount": "250000",
  "network": "mainnet"
}
```

**Response:**
```json
{
  "txid": "0x..."
}
```

`feeToken` and `feeAmount` are optional — omit for `DEVELOPER_SPONSORS` policy.

---

### `POST /api/v1/estimate`

Returns a real-time fee estimate in the requested SIP-010 token.

**Body:**
```json
{
  "feeToken": "SP...aeusdc",
  "estimatedGas": 150000
}
```

**Response:**
```json
{
  "maxFee": "250000",
  "feeToken": "SP...aeusdc",
  "policy": "DEVELOPER_SPONSORS",
  "relayerAddress": "SP..."
}
```

---

### `GET /api/v1/config`

Returns the project configuration for the authenticated API key.

---

## Environment Variables

| Variable | Description | Required |
| :--- | :--- | :--- |
| `MASTER_KEY` | HD master key for relayer address derivation | Yes |
| `DATABASE_URL` | Prisma database connection string | Yes |
| `NETWORK` | `mainnet` or `testnet` | Yes |
| `STACKS_API_URL` | Stacks API endpoint for broadcast | Yes |
| `PRICING_ORACLE_URL` | Token pricing oracle endpoint | Yes |

---

## Local Development

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

The relayer runs on port `3001` by default.

---

## Sponsorship Policies

### DEVELOPER_SPONSORS
The developer's relayer pays STX gas. Users pay nothing. The relayer co-signs any valid sponsored transaction from an authenticated API key.

### USER_PAYS
The user pays a SIP-010 token fee via a paymaster contract the developer deploys. The relayer validates the fee parameters before co-signing.

Both policies use the same `POST /api/v1/sponsor` endpoint — the difference is whether `feeToken` and `feeAmount` are included.

---

## Security

- **API key validation**: Every request requires a valid API key. Keys are project-scoped and can be revoked from the dashboard.
- **Rate limiting**: Per-key rate limits prevent abuse.
- **Spending caps**: Per-key STX spending caps prevent runaway costs.
- **No contract inspection**: The relayer does not validate what contract is being called — that's the developer's responsibility.
- **Sponsored tx validation**: The relayer verifies `AuthType.Sponsored` (0x05) before co-signing.

---

Built with ❤️ by the VelumX team
