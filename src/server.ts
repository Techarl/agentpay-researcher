import cors from "cors";
import express from "express";
import { appendLedgerEntry, listLedgerEntries } from "./ledger.js";
import { createPaymentRequirement, verifyPaymentHeader } from "./payment.js";
import { buildPremiumSearchResult, SearchProviderError } from "./search.js";
import { config } from "./config.js";
import type { LedgerEntry } from "./types.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "agentpay-researcher" });
});

app.get("/api/ledger", async (_req, res, next) => {
  try {
    res.json({ entries: await listLedgerEntries() });
  } catch (error) {
    next(error);
  }
});

app.post("/api/premium-search", async (req, res, next) => {
  try {
    const query = String(req.body?.query ?? "").trim();

    if (!query) {
      res.status(400).json({ error: "Missing required body field: query" });
      return;
    }

    const requirement = createPaymentRequirement(query);
    const payment = verifyPaymentHeader(req.header("x-agent-payment"), requirement);

    if (!payment.ok) {
      res.status(402).json({
        error: "Payment required",
        reason: payment.reason,
        paymentRequired: requirement
      });
      return;
    }

    const ledgerEntry: LedgerEntry = await appendLedgerEntry({
      query,
      amount: requirement.amount,
      protocol: payment.receipt.protocol,
      timestamp: new Date().toISOString(),
      invoiceId: requirement.invoiceId,
      txId: payment.receipt.txId
    });

    res.json(await buildPremiumSearchResult(query, ledgerEntry));
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof SearchProviderError) {
    res.status(502).json({ error: "Search provider error", reason: error.message });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(config.port, () => {
  console.log(`agentpay-researcher API listening on ${config.apiBaseUrl}`);
});
