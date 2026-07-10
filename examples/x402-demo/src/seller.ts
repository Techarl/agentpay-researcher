import "dotenv/config";
import express from "express";
import { paymentMiddleware } from "x402-express";

const app = express();

const port = Number(process.env.PORT ?? 4021);
const network = process.env.X402_NETWORK ?? "base-sepolia";
const price = process.env.X402_PRICE_USD ?? "0.001";
const receivingAddress = process.env.X402_RECEIVING_ADDRESS;

if (!receivingAddress || receivingAddress === "0x0000000000000000000000000000000000000000") {
  throw new Error("Set X402_RECEIVING_ADDRESS to a testnet receiving address before starting the seller.");
}

if (!receivingAddress.startsWith("0x")) {
  throw new Error("X402_RECEIVING_ADDRESS must be a 0x-prefixed address.");
}

if (network !== "base-sepolia") {
  throw new Error("This demo only supports X402_NETWORK=base-sepolia.");
}

app.use(
  paymentMiddleware(
    receivingAddress as `0x${string}`,
    {
      "/premium-search": {
        price: `$${price}`,
        network
      }
    },
    {
      url: "https://x402.org/facilitator"
    }
  )
);

app.get("/premium-search", (req, res) => {
  const query = String(req.query.q ?? "agent payments");

  res.json({
    query,
    provider: "x402-demo",
    summary: `This response was gated by an x402 payment requirement for "${query}".`,
    sources: [
      {
        title: "x402 seller demo",
        url: "https://docs.cdp.coinbase.com/x402/welcome",
        snippet: "The endpoint returned only after the x402 payment middleware accepted the buyer payment."
      }
    ]
  });
});

app.listen(port, () => {
  console.log(`x402 seller listening on http://localhost:${port}`);
});
