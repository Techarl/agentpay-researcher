# x402 Integration Feasibility

This document records the current implementation assumptions for the isolated real x402 buyer example in `examples/x402-real-buyer`.

## 1. Is Real x402 Buyer Payment Possible Today?

Yes, with constraints. The official x402 packages provide buyer tooling that can detect HTTP 402 responses, create x402 payment headers, and retry paid requests. The example in this repository uses the official `@x402/fetch`, `@x402/core`, and `@x402/evm` packages.

The repository defaults to dry-run mode, which only discovers and parses the payment requirement. Real payment requires explicit `--testnet` or `--mainnet --confirm-real-money` flags and a wallet private key supplied through `.env`.

## 2. What Networks Are Supported?

The x402 v2 TypeScript packages use CAIP-2 network identifiers, such as:

- Base mainnet: `eip155:8453`
- Base Sepolia: `eip155:84532`

The official docs and package types also reference additional EVM and non-EVM networks. This example intentionally starts with Base Sepolia as the default testnet path and supports alias mapping from `base-sepolia` to `eip155:84532`.

## 3. Is Testnet Supported?

Yes. Base Sepolia is supported by the public demo endpoint tested during implementation. The endpoint `https://x402.org/protected` returns a real HTTP 402 response with a `Payment-Required` header including a Base Sepolia payment requirement.

Testnet execution still requires:

- a burner EVM wallet
- testnet USDC or compatible x402 asset
- any required gas/faucet setup for the selected testnet
- endpoint availability at run time

## 4. What Asset Is Required?

For the public `https://x402.org/protected` endpoint observed during implementation, the payment requirement advertises an `exact` scheme on Base Sepolia with a USDC-like asset address and an amount in atomic units. The observed amount was `10000`, which is approximately `$0.01` assuming 6 decimals.

The buyer does not hardcode a token. It reads the asset from the 402 payment requirement.

## 5. What Wallet Format Is Required?

The EVM buyer path expects a `0x`-prefixed private key compatible with `viem/accounts` `privateKeyToAccount`.

The key must be supplied by environment variable only:

```bash
X402_PRIVATE_KEY=0x...
```

Do not commit private keys, seed phrases, generated wallets, or `.env` files.

## 6. What Official Packages Should Be Used?

This example uses:

- `@x402/fetch` for `wrapFetchWithPayment`
- `@x402/core` for `x402Client` and x402 HTTP utilities
- `@x402/evm` for `ExactEvmScheme`
- `viem` for private-key account loading

The official buyer flow wraps `fetch`, registers an EVM exact scheme for a network, and retries the request with the generated x402 payment header when a 402 response is received.

## 7. What Paid Endpoint Can Be Used For A Real Test?

The default endpoint for dry-run discovery is:

```text
https://x402.org/protected
```

It currently returns HTTP 402 with a `Payment-Required` header. The header points to the protected resource and includes Base Sepolia requirements.

## 8. Does The Endpoint Require API Keys, Account Setup, Or KYC?

The public demo endpoint did not require an API key to receive the HTTP 402 payment requirement.

Real payment may still require:

- testnet funds
- a supported wallet
- facilitator availability
- possibly CDP facilitator credentials for other endpoints or mainnet flows

No KYC requirement was validated by this repository. Users must check the endpoint and facilitator they choose.

## 9. What Exact Commands Should The User Run?

Dry-run requirement discovery:

```bash
pnpm run x402:buyer -- --query "latest Tempo MPP agent payments" --budget 0.10 --dry-run
```

Testnet real payment attempt:

```bash
pnpm run x402:buyer -- --query "latest Tempo MPP agent payments" --budget 0.10 --testnet
```

Mainnet real payment attempt:

```bash
pnpm run x402:buyer -- --query "latest Tempo MPP agent payments" --budget 0.10 --mainnet --confirm-real-money
```

Mainnet refuses to run without both `--mainnet` and `--confirm-real-money`.

## 10. What Is Blocked Or Unclear?

- A real paid test was not executed in this repository because no private key, faucet tokens, or paid endpoint credentials were provided.
- The public test endpoint may change or become unavailable.
- Faucet availability and testnet asset distribution are external dependencies.
- Some x402 facilitator paths may require API keys or account setup.
- The example does not bridge funds, swap tokens, or auto-acquire assets.
- The example does not claim payment success unless a payment response, transaction hash, facilitator receipt, or provider response is available.

## References

- Coinbase x402 buyer quickstart: https://docs.cdp.coinbase.com/x402/quickstart-for-buyers
- Coinbase x402 seller quickstart: https://docs.cdp.coinbase.com/x402/quickstart-for-sellers
- x402 docs: https://docs.x402.org/
- x402 public examples: https://x402.org/
