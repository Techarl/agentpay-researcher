# MPP / Tempo Demo

Experimental Machine Payments Protocol and Tempo integration area.

This folder is intentionally separate from the main project because it needs testnet payment credentials and may evolve as MPP/Tempo libraries evolve. The main project stays safe and runnable with mock payments; this folder is where a real MPP-style payment gate can be tested.

Use testnet only. Do not use production keys, production wallets, or mainnet funds here.

## Files

- `src/server.ts` defines a `/paid-research` endpoint protected by an MPP middleware shape.
- `.env.example` documents the required testnet settings.

## Run

```bash
cd examples/mpp-tempo-demo
pnpm install
cp .env.example .env
```

Edit `.env` with testnet-only values:

```bash
MPP_TEMPO_CURRENCY_ADDRESS=0xYourTempoTestnetTokenAddress
MPP_TEMPO_RECIPIENT=0xYourTempoTestnetRecipient
MPP_SECRET_KEY=local_dev_secret_at_least_32_bytes
```

Start the server:

```bash
pnpm run dev
```

Then call the endpoint with an MPP-compatible buyer or CLI:

```bash
mppx fetch "http://localhost:4030/paid-research?q=agent%20payments"
```

## How It Relates To The Main Demo

The main demo proves the application flow:

unpaid request -> HTTP 402-style payment requirement -> budget check -> paid retry -> premium result.

This example is for replacing the mock payment receipt with an MPP/Tempo-compatible testnet flow.

## Production Gaps

Before using this pattern in production, add:

- strict merchant allowlisting
- spending policy enforcement outside the model prompt
- replay protection
- durable payment records
- key isolation
- audit logging
- rate limits
- real settlement reconciliation

## References

- [MPP - Machine Payments Protocol](https://mpp.dev/)
- [Stripe MPP payments docs](https://docs.stripe.com/payments/machine/mpp)
- [Tempo](https://tempo.xyz/)
