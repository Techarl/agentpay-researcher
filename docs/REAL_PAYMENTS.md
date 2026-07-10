# Real Payments

The main `agentpay-researcher` project remains mock-only. It demonstrates HTTP 402-style payment negotiation without touching real wallets or real funds.

Real payment experiments are isolated under `examples/`.

## x402 Real Buyer

The real x402 buyer example lives at:

```text
examples/x402-real-buyer
```

It can discover a real HTTP 402 payment requirement and, only when explicitly requested, attempt payment using official x402 buyer packages.

Dry-run does not spend money:

```bash
pnpm run x402:buyer -- --query "test query" --budget 0.10 --dry-run
```

Testnet mode may spend testnet assets and may require faucet tokens:

```bash
pnpm run x402:buyer -- --query "test query" --budget 0.10 --testnet
```

Mainnet mode uses real money and requires both flags:

```bash
pnpm run x402:buyer -- --query "test query" --budget 0.10 --mainnet --confirm-real-money
```

## Safety Rules

- Private keys must only live in `.env`.
- Never commit `.env`, seed phrases, private keys, wallet exports, screenshots, or generated key files.
- Use a burner wallet.
- Keep balances small.
- Enforce endpoint allowlists.
- Enforce network allowlists.
- Enforce per-request and per-run budgets.
- Do not bridge automatically.
- Do not swap automatically.
- Do not claim success unless there is a transaction hash, facilitator receipt, or provider response.

## Manual Setup

Set:

```bash
X402_PRIVATE_KEY=0x...
X402_NETWORK=base-sepolia
X402_ALLOWED_ENDPOINTS=https://x402.org/protected
X402_MAX_PER_REQUEST_USD=0.10
X402_MAX_PER_RUN_USD=0.25
```

For real testnet execution, manually fund the wallet with the gas and token required by the endpoint.
