# x402 Demo

This example is intentionally separate from the main mock-payment demo. It shows where a real Coinbase x402 buyer/seller flow can live once you are ready to test with funded testnet wallets.

Use testnet funds only. Do not paste production wallet private keys into this example.

## Files

- `src/seller.ts` starts an Express endpoint protected by `x402-express`.
- `src/buyer.ts` calls the paid endpoint with `x402-fetch`.
- `.env.example` documents the required testnet settings.

## Run

```bash
cd examples/x402-demo
pnpm install
cp .env.example .env
```

Edit `.env`:

```bash
X402_RECEIVING_ADDRESS=0xYourTestnetReceivingAddress
BUYER_PRIVATE_KEY=0xYourFundedTestnetBuyerPrivateKey
```

Start the seller:

```bash
pnpm run dev:seller
```

In another terminal:

```bash
pnpm run dev:buyer
```

## How It Relates To The Main Demo

The main project uses a mock `x-agent-payment` receipt so anyone can run the flow without funds.

This folder is the next step: a real HTTP 402 gate where the seller middleware emits a payment requirement and the buyer wrapper handles the paid retry.

## References

- [x402 overview](https://docs.cdp.coinbase.com/x402/welcome)
- [x402 seller quickstart](https://docs.cdp.coinbase.com/x402/quickstart-for-sellers)
- [x402 buyer quickstart](https://docs.cdp.coinbase.com/x402/quickstart-for-buyers)
