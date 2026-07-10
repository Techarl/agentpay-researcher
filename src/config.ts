import "dotenv/config";
import path from "node:path";
import type { PaymentProtocol, SearchProvider } from "./types.js";

const protocol = process.env.PAYMENT_PROTOCOL ?? "mock-x402";
const searchProvider = process.env.SEARCH_PROVIDER ?? "mock";

if (protocol !== "mock-x402" && protocol !== "mock-mpp") {
  throw new Error("PAYMENT_PROTOCOL must be mock-x402 or mock-mpp");
}

if (searchProvider !== "mock" && searchProvider !== "tavily" && searchProvider !== "exa" && searchProvider !== "brave") {
  throw new Error("SEARCH_PROVIDER must be mock, tavily, exa, or brave");
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  apiBaseUrl: process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`,
  premiumSearchPrice: process.env.PREMIUM_SEARCH_PRICE ?? "0.02",
  paymentProtocol: protocol as PaymentProtocol,
  paymentCurrency: process.env.PAYMENT_CURRENCY ?? "USDC",
  paymentRecipient: process.env.PAYMENT_RECIPIENT ?? "merchant_demo_wallet_do_not_use",
  ledgerPath: path.resolve(process.env.LEDGER_PATH ?? "./data/ledger.json"),
  searchProvider: searchProvider as SearchProvider,
  tavilyApiKey: process.env.TAVILY_API_KEY,
  exaApiKey: process.env.EXA_API_KEY,
  braveApiKey: process.env.BRAVE_API_KEY,
  searchResultLimit: Number(process.env.SEARCH_RESULT_LIMIT ?? 5)
};
