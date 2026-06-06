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
NEXT_PUBLIC_TEST_EXCHANGE_ADDRESS=

BASE_SEPOLIA_RPC=
FAUCET_PRIVATE_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

`FAUCET_PRIVATE_KEY` is server-only. Never expose it as `NEXT_PUBLIC_*`.

For the faucet to work, `BASE_SEPOLIA_RPC` must be a real Base Sepolia RPC URL and
`FAUCET_PRIVATE_KEY` must belong to a wallet that holds test FLOW and Base Sepolia ETH for gas.
On Vercel, attach a Redis integration so these Redis env vars are injected into the project.

## Faucet

`POST /api/faucet`

```json
{
  "address": "0x..."
}
```

The route sends `1,000,000 FLOW` from the faucet wallet and applies a 24h cooldown per address.
It also applies the same cooldown per client IP when `x-forwarded-for` is available, which it is on Vercel.
If Redis is configured, cooldown state is stored in Redis and shared across Vercel instances.
Without Redis, local development falls back to `data/solidus-db.json`.

After the next protocol redeploy, the faucet must be registered as a permanent Solidus service wallet.
Its FLOW allocation is fixed when registered. Faucet distributions are
fee-free and do not emit PRIME. Users cannot send FLOW or PRIME back to the
faucet, and the faucet cannot participate in PRIME market or redemption paths.

## Local Data Store

Dev/test data is stored in:

```text
data/solidus-db.json
```

It currently stores:

- faucet wallet cooldown timestamps.

This file is ignored by git. It is only used as a local fallback when Redis is not configured.

PRIME market orders are not stored in the backend. `PrimeMarket` exposes them on-chain through `nextOrderId()` and `orders(id)`, so the UI can read the order list directly from Base Sepolia.

## User Flow

1. Connect wallet.
2. Switch to Base Sepolia.
3. Get test FLOW.
4. Transfer FLOW.
5. See PRIME balance change.
6. Buy, sell, or redeem PRIME.

`PrimeMarket` is protocol logic for PRIME/FLOW settlement. The market is intentionally limited to FLOW and PRIME only.

`TestExchange` is a separate public testnet orderbook for FLOW against native Base Sepolia ETH or arbitrary test ERC-20 tokens. PRIME is explicitly excluded from that exchange.
