import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Mppx, tempo } from "mppx/hono";

const port = Number(process.env.PORT ?? 4030);
const amount = process.env.MPP_TEMPO_AMOUNT ?? "0.001";
const currency = process.env.MPP_TEMPO_CURRENCY_ADDRESS;
const decimals = Number(process.env.MPP_TEMPO_DECIMALS ?? 6);
const recipient = process.env.MPP_TEMPO_RECIPIENT;
const secretKey = process.env.MPP_SECRET_KEY;

if (!currency || currency === "0x0000000000000000000000000000000000000000") {
  throw new Error("Set MPP_TEMPO_CURRENCY_ADDRESS to a Tempo testnet TIP-20 token address.");
}

if (!recipient || recipient === "0x0000000000000000000000000000000000000000") {
  throw new Error("Set MPP_TEMPO_RECIPIENT to a Tempo testnet recipient before starting the demo.");
}

if (!currency.startsWith("0x") || !recipient.startsWith("0x")) {
  throw new Error("MPP_TEMPO_CURRENCY_ADDRESS and MPP_TEMPO_RECIPIENT must be 0x-prefixed addresses.");
}

if (!secretKey || secretKey.length < 32 || secretKey === "replace_with_at_least_32_bytes_local_demo_secret") {
  throw new Error("Set MPP_SECRET_KEY to a local demo secret of at least 32 bytes.");
}

const app = new Hono();
const mppx = Mppx.create({
  methods: [
    tempo.charge({
      currency: currency as `0x${string}`,
      decimals,
      recipient: recipient as `0x${string}`,
      testnet: true
    })
  ],
  secretKey
});

app.get(
  "/paid-research",
  mppx.tempo.charge({
    amount,
    description: "agentpay-researcher MPP Tempo testnet demo",
    meta: {
      app: "agentpay-researcher"
    }
  }),
  (c) => {
    const query = c.req.query("q") ?? "agent payments";

    return c.json({
      query,
      provider: "mpp-tempo-demo",
      summary: `This response represents an MPP/Tempo testnet-gated research result for "${query}".`,
      payment: {
        protocol: "mpp",
        network: "tempo-testnet",
        currency,
        decimals,
        amount
      }
    });
  }
);

serve(
  {
    fetch: app.fetch,
    port
  },
  () => {
    console.log(`MPP/Tempo demo listening on http://localhost:${port}`);
  }
);
