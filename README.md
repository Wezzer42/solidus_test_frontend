# Solidus Testnet Frontend

Minimal public UI for the Solidus Base Sepolia live test.

Core message:

```text
Mine the economy, not the hardware.
FLOW moves value.
PRIME rewards participation.
```

## Stack

- Next.js App Router
- TypeScript
- Tailwind
- viem + injected wallet provider
- Base Sepolia only

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

```bash
NEXT_PUBLIC_BASE_SEPOLIA_RPC=
NEXT_PUBLIC_FLOW_ADDRESS=
NEXT_PUBLIC_PRIME_ADDRESS=
NEXT_PUBLIC_RESERVE_ADDRESS=
NEXT_PUBLIC_PRIME_MARKET_ADDRESS=

BASE_SEPOLIA_RPC=
FAUCET_PRIVATE_KEY=
```

`FAUCET_PRIVATE_KEY` is server-only. Never expose it as `NEXT_PUBLIC_*`.

For the faucet to work, `BASE_SEPOLIA_RPC` must be a real Base Sepolia RPC URL and
`FAUCET_PRIVATE_KEY` must belong to a wallet that holds test FLOW and Base Sepolia ETH for gas.

## Faucet

`POST /api/faucet`

```json
{
  "address": "0x..."
}
```

The route sends `1,000,000 FLOW` from the faucet wallet and applies a 24h cooldown per address.

## Local Data Store

Dev/test data is stored in:

```text
data/solidus-db.json
```

It currently stores:

- faucet wallet cooldown timestamps.

This file is ignored by git. On Vercel or other serverless hosting, replace this with durable storage because local filesystem state is not durable.

PRIME market orders are not stored in the backend. `PrimeMarket` exposes them on-chain through `nextOrderId()` and `orders(id)`, so the UI can read the order list directly from Base Sepolia.

## User Flow

1. Connect wallet.
2. Switch to Base Sepolia.
3. Get test FLOW.
4. Transfer FLOW.
5. See PRIME balance change.
6. Buy, sell, or redeem PRIME.

`PrimeMarket` is protocol logic for PRIME/FLOW settlement. The market is intentionally limited to FLOW and PRIME only.
