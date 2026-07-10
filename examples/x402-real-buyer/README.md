# x402 Real Buyer

This is an isolated experimental buyer agent for real x402 HTTP 402 payment flows.

The main `agentpay-researcher` app remains mock-only. This folder is the opt-in area for real x402 discovery and payment attempts.

## What This Example Does

The CLI can call an x402 paid endpoint without payment, detect HTTP `402 Payment Required`, parse the x402 payment requirement, enforce endpoint/network/budget allowlists, stop safely in dry-run mode, or use official x402 buyer tooling to retry with a payment header in explicit real-payment modes.

## What x402 Is

x402 is a protocol that uses HTTP 402-style responses to let servers advertise machine-readable payment requirements. A buyer can inspect the requirement, decide whether it is allowed to pay, create a payment payload, retry the request with payment evidence, and receive the gated resource.

## Mock Payment vs Real x402 Payment

The main project uses a mock receipt in `x-agent-payment`. It is safe and does not move funds.

This example uses official x402 buyer packages. In `--testnet` or confirmed mainnet mode, it may sign payment payloads and can spend real or testnet assets depending on the endpoint, network, wallet, facilitator, and asset.

## Dry-Run Mode

Dry-run is the default. It sends the unpaid request, parses the HTTP 402 requirement, prints amount/asset/network/recipient/facilitator fields when present, writes `status: "dry-run"` to the ledger, and does not sign or retry as paid.

```bash
pnpm run x402:buyer -- --query "latest Tempo MPP agent payments" --budget 0.10 --dry-run
```

## Testnet Mode

Testnet mode requires a burner wallet private key in `.env`:

```bash
X402_PRIVATE_KEY=0x...
X402_NETWORK=base-sepolia
```

Run:

```bash
pnpm run x402:buyer -- --query "latest Tempo MPP agent payments" --budget 0.10 --testnet
```

Testnet may still require faucet ETH, testnet USDC or the endpoint's required asset, and endpoint/facilitator availability.

## Mainnet Mode

Mainnet uses real money. It refuses to run unless both flags are present:

```bash
pnpm run x402:buyer -- --query "latest Tempo MPP agent payments" --budget 0.10 --mainnet --confirm-real-money
```

Use a dedicated wallet with a tiny balance. Do not use a primary wallet.

## Burner Wallet

Create a burner wallet outside this repository using a trusted wallet tool. Store only the private key in `.env`:

```bash
X402_PRIVATE_KEY=0x...
```

Never commit `.env`, generated key files, seed phrases, screenshots, or wallet exports.

## Funding The Wallet

Fund the wallet manually. Use official testnet faucets for gas, check the endpoint requirement for the required asset, and keep balances low.

## Why No Automatic Bridge Or Swap

Automatic bridge and swap logic greatly expands risk: wrong chain, wrong asset, hostile quotes, excess approvals, slippage, MEV, or prompt-injected spending. This example only pays when the wallet already holds the required network asset.

## Network And Asset

The default dry-run endpoint is:

```text
https://x402.org/protected
```

The observed payment requirement includes Base Sepolia, represented by x402 v2 as `eip155:84532`. The `.env` default uses the friendly alias `base-sepolia`, which the CLI maps to `eip155:84532`.

The CLI reads the asset address and amount from the endpoint's 402 requirement.

If you want to pass the query into a custom endpoint URL, use a `{query}` placeholder:

```bash
pnpm run x402:buyer -- --endpoint "https://example.com/paid-search?q={query}" --query "agent payments" --budget 0.10 --dry-run
```

## Avoiding Key Leaks

- Keep private keys only in `.env`.
- Do not pass private keys as command-line arguments.
- Do not paste private keys into README files, issues, PRs, logs, or screenshots.
- The CLI prints the wallet address only, never the private key.
- Ledger entries never include private keys.

## Ledger

Inspect:

```powershell
Get-Content examples/x402-real-buyer/ledger/x402-ledger.json
```

The ledger records query, endpoint, mode, network, asset, amount, wallet address, transaction hash when available, facilitator receipt when available, timestamp, status, and error.

## Known Limitations

- Real testnet payment was not executed during implementation because no private key or funded wallet was provided.
- The public demo endpoint can change or go offline.
- The example currently focuses on EVM exact-scheme payments.
- It does not bridge, swap, request faucet tokens, or manage approvals outside official x402 tooling.
- It does not claim payment success without a transaction hash, facilitator receipt, or provider response.
