# Threat Model

This project demonstrates agent payments for paid research APIs. The main demo uses mock payments, but the same application shape becomes high risk when connected to real wallets, real payment facilitators, or real search providers.

## Assets

- User spending budget
- Wallet credentials and payment authorization material
- Merchant allowlist and payment policy
- Payment receipts and ledger records
- Research query contents
- Search API keys
- Paid search results

## Trust Boundaries

- User prompt to agent policy engine
- Agent to paid API server
- Paid API server to search provider
- Agent or server to wallet/payment facilitator
- Local ledger to durable production accounting system

## Threats

| Threat | Risk | Mitigation |
| --- | --- | --- |
| Malicious payment request | A fake or compromised endpoint asks the agent to pay too much or pay the wrong recipient. | Enforce merchant allowlists, recipient allowlists, max price caps, expected protocol checks, and signed payment requirements. |
| Prompt injection causing unwanted spending | Search results or user-provided text instruct the agent to ignore budget rules and spend more. | Keep budget enforcement outside the model prompt, use deterministic policy code, and require explicit user approval above thresholds. |
| Replayed payment header | A captured payment receipt is reused to unlock another request. | Bind receipts to invoice id, amount, recipient, method, request hash, and expiration; store consumed proofs atomically. |
| Overspending risk | The agent pays many small charges that add up. | Track per-request, per-session, per-day, and per-merchant limits; fail closed when ledger writes fail. |
| Fake merchant endpoint | DNS, config, or UI trickery sends the agent to a lookalike paid endpoint. | Pin merchant identity, verify TLS, use signed payment metadata, and separate dev/test/prod configs. |
| Private key leakage | A developer puts production wallet keys in `.env` or logs. | Use testnet keys only in examples, isolate signing, avoid logging secrets, and prefer wallet/facilitator services over raw private keys. |
| Untrusted API result | Paid search content includes false data, malicious links, or prompt injection. | Treat search output as untrusted data, cite sources, sanitize rendered content, and keep tool-use policies separate from content. |
| Ledger tampering | Local JSON records are modified or lost. | Use append-only durable storage, transaction ids, reconciliation jobs, and access controls in production. |
| Search API key abuse | A leaked search key can generate provider charges. | Store keys in secret managers, rate limit server-side, rotate keys, and avoid exposing provider keys to clients. |

## Current Demo Controls

- Mock payments only by default.
- No real wallet integration in the main app.
- Per-request budget check in the client agent.
- Payment receipt validation checks protocol, amount, currency, invoice id, and mock signature.
- Local ledger records payment-like events for inspection.
- Real search providers are server-side only and require explicit API keys.

## Production Gaps

Before using this pattern with real funds:

- Move policy enforcement into audited, deterministic code.
- Add strong authentication for agents and merchants.
- Use real signature and settlement verification.
- Add replay protection backed by durable storage.
- Add merchant and recipient allowlists.
- Add user approval workflows for high-value or new merchants.
- Encrypt and rotate secrets.
- Use durable ledger storage and reconciliation.
- Add observability, rate limits, and incident response runbooks.
