# agentpay-researcher

[Chinese README](./README.zh-CN.md) | [Threat model](./docs/THREAT_MODEL.md)

A minimal TypeScript research agent that demonstrates machine-to-machine payments for premium search APIs using HTTP 402-style flows.

The main project intentionally uses mock payments only. It never asks for private keys, never signs real transactions, and never moves real funds. Real x402 and MPP/Tempo experiments live under `examples/` and are testnet-oriented.

## What It Shows

1. A client agent receives a user research query.
2. The agent calls `POST /api/premium-search` without payment.
3. The API returns `402 Payment Required` with a payment requirement object.
4. The agent checks the required amount against a max budget.
5. If the budget allows it, the agent simulates a payment receipt.
6. The agent retries the request with an `x-agent-payment` header.
7. The API validates the mock receipt, calls the configured search provider, returns premium search results, and writes a ledger entry.

## Quick Start

```bash
pnpm install
cp .env.example .env
pnpm run dev
```

In another terminal:

```bash
pnpm run agent -- "stablecoin payment APIs for AI agents" --budget 0.05
```

View the ledger:

```bash
pnpm run ledger
```

Reset the ledger:

```bash
pnpm run reset:ledger
```

## Real Search Providers

The default provider is `mock`, so the project runs without API keys. To turn the demo into `mock payment + real premium search result`, set one of these providers in `.env`:

```bash
SEARCH_PROVIDER=tavily
TAVILY_API_KEY=...
```

```bash
SEARCH_PROVIDER=exa
EXA_API_KEY=...
```

```bash
SEARCH_PROVIDER=brave
BRAVE_API_KEY=...
```

Supported provider values:

| Provider | Env key | Notes |
| --- | --- | --- |
| `mock` | none | Default, no external calls |
| `tavily` | `TAVILY_API_KEY` | Uses Tavily Search API |
| `exa` | `EXA_API_KEY` | Uses Exa Search API |
| `brave` | `BRAVE_API_KEY` | Uses Brave Search API |

## API

### `POST /api/premium-search`

Request:

```json
{
  "query": "stablecoin payment APIs for AI agents"
}
```

Unpaid response:

```json
{
  "error": "Payment required",
  "reason": "missing payment header",
  "paymentRequired": {
    "protocol": "mock-x402",
    "amount": "0.02",
    "currency": "USDC",
    "recipient": "merchant_demo_wallet_do_not_use",
    "invoiceId": "mock_inv_...",
    "expiresAt": "2026-01-01T00:00:00.000Z",
    "paymentHeader": "x-agent-payment",
    "memo": "Premium research for: ..."
  }
}
```

Paid retry:

```http
POST /api/premium-search
content-type: application/json
x-agent-payment: mock-x402 <base64url mock receipt>
```

### `GET /api/ledger`

Returns the mock payment ledger:

```json
{
  "entries": [
    {
      "query": "stablecoin payment APIs for AI agents",
      "amount": "0.02",
      "protocol": "mock-x402",
      "timestamp": "2026-01-01T00:00:00.000Z",
      "invoiceId": "mock_inv_...",
      "txId": "mock_tx_..."
    }
  ]
}
```

## Examples

- [`examples/x402-demo`](./examples/x402-demo): separate Coinbase x402 buyer/seller demo using testnet-only wallet configuration.
- [`examples/mpp-tempo-demo`](./examples/mpp-tempo-demo): experimental MPP/Tempo testnet integration area using `mppx`.

## Threat Model

See [docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md). It covers malicious payment requests, prompt injection causing unwanted spending, replayed payment headers, overspending, fake merchant endpoints, private key leakage, untrusted API results, ledger tampering, and search API key abuse.

## How This Maps To Real Payment Protocols

### HTTP 402

HTTP `402 Payment Required` is used here as the negotiation point between a resource server and an autonomous client. The first response tells the client what payment is required, where to send it, what protocol to use, and which header to include on retry.

In production, the mock receipt would be replaced with a verifiable payment proof, signed authorization, or facilitator-issued settlement confirmation.

### MPP

`mock-mpp` stands for the Machine Payments Protocol pattern. The important flow is:

- The API describes a machine-readable payment requirement.
- The agent checks policy, budget, and user intent before paying.
- The agent obtains a payment proof from a wallet, payment service, or payment facilitator.
- The API verifies the proof before returning the premium resource.

This repository keeps the MPP path abstract so it can be adapted to a real MPP provider, wallet, facilitator, or payment method.

### x402

`mock-x402` models an x402-style flow where HTTP `402` responses carry structured payment requirements and the client retries with payment evidence in a header. Real x402 implementations typically add stricter payment requirement schemas, chain or asset identifiers, facilitator verification, replay protection, and settlement rules.

### Tempo

Tempo is relevant as an example of stablecoin-focused payment infrastructure. A real version of this demo could settle agent payments on a fast, low-cost stablecoin network, while still presenting the same application-level flow: unpaid request, `402` requirement, agent budget approval, payment proof, paid retry.

### Stablecoin Micropayments

Premium search is a natural micropayment example because the agent may only need one paid result, one enriched source, or one ranking call. Stablecoins can make the amount predictable for the agent budget, while a 402-style protocol makes the payment step machine-readable instead of forcing a human checkout flow.

## Environment

See `.env.example`.

| Variable | Purpose |
| --- | --- |
| `PORT` | Express server port |
| `API_BASE_URL` | Base URL used by the client agent |
| `PREMIUM_SEARCH_PRICE` | Mock price charged by `/api/premium-search` |
| `PAYMENT_PROTOCOL` | `mock-x402` or `mock-mpp` |
| `PAYMENT_CURRENCY` | Display currency for the mock payment |
| `PAYMENT_RECIPIENT` | Mock recipient address or account |
| `LEDGER_PATH` | File path for the local JSON ledger |
| `SEARCH_PROVIDER` | `mock`, `tavily`, `exa`, or `brave` |
| `SEARCH_RESULT_LIMIT` | Maximum number of search results to request |
| `TAVILY_API_KEY` | Tavily API key, only used with `SEARCH_PROVIDER=tavily` |
| `EXA_API_KEY` | Exa API key, only used with `SEARCH_PROVIDER=exa` |
| `BRAVE_API_KEY` | Brave API key, only used with `SEARCH_PROVIDER=brave` |

## Safety Notes

- Do not put private keys in `.env`.
- Do not connect this demo directly to a production wallet.
- Treat `x-agent-payment` as an educational mock receipt format.
- Use testnet-only credentials in `examples/`.
- Add authentication, replay protection, rate limits, durable storage, real signature verification, and audited payment SDKs before using a similar pattern in production.

## References

- [MPP - Machine Payments Protocol](https://mpp.dev/)
- [Stripe MPP payments docs](https://docs.stripe.com/payments/machine/mpp)
- [x402 overview](https://docs.cdp.coinbase.com/x402/welcome)
- [x402 HTTP 402 concept](https://docs.cdp.coinbase.com/x402/core-concepts/http-402)
- [Tempo](https://tempo.xyz/)
- [MDN: 402 Payment Required](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/402)

## Scripts

```bash
pnpm run dev
pnpm run build
pnpm run start
pnpm run agent -- "your query" --budget 0.05
pnpm run ledger
pnpm run reset:ledger
```

## License

MIT
