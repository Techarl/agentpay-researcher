import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { x402Client } from "@x402/core/client";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import type { Network, PaymentRequired, PaymentRequirements, SettleResponse } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm";
import { wrapFetchWithPayment } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";

type Mode = "dry-run" | "testnet" | "mainnet";
type LedgerStatus = "dry-run" | "paid" | "failed" | "blocked";

type CliArgs = {
  query: string;
  budget: number;
  endpoint?: string;
  dryRun: boolean;
  testnet: boolean;
  mainnet: boolean;
  confirmRealMoney: boolean;
  network?: string;
  walletEnv: string;
};

type LedgerEntry = {
  query: string;
  endpoint: string;
  mode: Mode;
  network: string;
  asset?: string;
  amount?: string;
  walletAddress?: string;
  txHash?: string;
  facilitatorReceipt?: unknown;
  timestamp: string;
  status: LedgerStatus;
  error?: string;
};

const DEFAULT_ENDPOINTS = ["https://x402.org/protected", "https://x402.vercel.app/protected"];
const DEFAULT_NETWORK_ALIASES: Record<string, Network> = {
  "base-sepolia": "eip155:84532",
  base: "eip155:8453"
};

function readArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    query: "",
    budget: Number.NaN,
    dryRun: false,
    testnet: false,
    mainnet: false,
    confirmRealMoney: false,
    walletEnv: "X402_PRIVATE_KEY"
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") continue;
    if (arg === "--query") args.query = argv[++i] ?? "";
    else if (arg === "--budget") args.budget = Number(argv[++i]);
    else if (arg === "--endpoint") args.endpoint = argv[++i];
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--testnet") args.testnet = true;
    else if (arg === "--mainnet") args.mainnet = true;
    else if (arg === "--confirm-real-money") args.confirmRealMoney = true;
    else if (arg === "--network") args.network = argv[++i];
    else if (arg === "--wallet-env") args.walletEnv = argv[++i] ?? "X402_PRIVATE_KEY";
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.query.trim()) throw new Error('Missing --query. Example: pnpm run x402:buyer -- --query "test query" --budget 0.10 --dry-run');
  if (!Number.isFinite(args.budget) || args.budget <= 0) throw new Error("Missing or invalid --budget. Use a positive USD number.");
  return args;
}

function resolveMode(args: CliArgs): Mode {
  if (args.testnet && args.mainnet) throw new Error("Choose only one of --testnet or --mainnet.");
  if (args.mainnet && !args.confirmRealMoney) throw new Error("Mainnet mode requires both --mainnet and --confirm-real-money.");
  if (args.mainnet) return "mainnet";
  if (args.testnet) return "testnet";
  return "dry-run";
}

function normalizeNetwork(value: string): Network {
  return DEFAULT_NETWORK_ALIASES[value] ?? (value as Network);
}

function splitCsv(value: string | undefined): string[] {
  return (value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
}

function normalizeEndpointForPolicy(endpoint: string): string {
  const url = new URL(endpoint);
  return `${url.origin}${url.pathname}`.replace(/\/$/, "");
}

function getAllowedEndpoints(): string[] {
  const configured = splitCsv(process.env.X402_ALLOWED_ENDPOINTS);
  return (configured.length > 0 ? configured : DEFAULT_ENDPOINTS).map(normalizeEndpointForPolicy);
}

function getAllowedNetworks(): Network[] {
  const configured = splitCsv(process.env.X402_ALLOWED_NETWORKS);
  return (configured.length > 0 ? configured : ["base-sepolia", "eip155:84532"]).map(normalizeNetwork);
}

function assertEndpointAllowed(endpoint: string): void {
  const normalized = normalizeEndpointForPolicy(endpoint);
  const allowed = getAllowedEndpoints();
  if (!allowed.includes(normalized)) {
    throw new Error(`Endpoint is not allowlisted: ${normalized}. Allowed endpoints: ${allowed.join(", ")}`);
  }
}

function assertNetworkAllowed(network: Network): void {
  const allowed = getAllowedNetworks();
  if (!allowed.includes(network)) {
    throw new Error(`Network is not allowlisted: ${network}. Allowed networks: ${allowed.join(", ")}`);
  }
}

function endpointWithQuery(endpoint: string, query: string): string {
  if (endpoint.includes("{query}")) {
    return endpoint.replace("{query}", encodeURIComponent(query));
  }

  const url = new URL(endpoint);
  return url.toString();
}

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function parsePaymentRequiredFromBody(body: unknown): PaymentRequired | undefined {
  if (body && typeof body === "object" && Array.isArray((body as { accepts?: unknown }).accepts)) {
    return body as PaymentRequired;
  }
  return undefined;
}

async function parsePaymentRequired(response: Response): Promise<{ paymentRequired?: PaymentRequired; body: unknown }> {
  const header = response.headers.get("payment-required") ?? response.headers.get("x-payment-required");
  const body = await readJsonBody(response.clone());
  if (header) return { paymentRequired: decodePaymentRequiredHeader(header), body };
  return { paymentRequired: parsePaymentRequiredFromBody(body), body };
}

function selectedRequirement(paymentRequired: PaymentRequired, network: Network): PaymentRequirements {
  const accepts = paymentRequired.accepts ?? [];
  const match = accepts.find((requirement) => requirement.network === network) ?? accepts[0];
  if (!match) throw new Error("No payment requirements were advertised by the endpoint.");
  return match;
}

function requirementAmountAtomic(requirement: PaymentRequirements): string {
  const value = (requirement as unknown as { amount?: string; maxAmountRequired?: string }).amount ??
    (requirement as unknown as { maxAmountRequired?: string }).maxAmountRequired ??
    "0";
  return String(value);
}

function requirementPayTo(requirement: PaymentRequirements): string {
  return String((requirement as unknown as { payTo?: string }).payTo ?? "");
}

function assetDecimals(requirement: PaymentRequirements): number {
  const extra = (requirement as unknown as { extra?: Record<string, unknown> }).extra;
  const decimals = extra?.decimals;
  return typeof decimals === "number" && Number.isInteger(decimals) ? decimals : 6;
}

function estimateUsd(requirement: PaymentRequirements): number {
  return Number(requirementAmountAtomic(requirement)) / 10 ** assetDecimals(requirement);
}

function assertBudget(requirement: PaymentRequirements, cliBudget: number): void {
  const requiredUsd = estimateUsd(requirement);
  const maxPerRequest = Number(process.env.X402_MAX_PER_REQUEST_USD ?? "0.10");
  const maxPerRun = Number(process.env.X402_MAX_PER_RUN_USD ?? "0.25");
  const effectiveLimit = Math.min(cliBudget, maxPerRequest, maxPerRun);
  if (requiredUsd > effectiveLimit) {
    throw new Error(`Payment requirement $${requiredUsd.toFixed(6)} exceeds effective budget $${effectiveLimit.toFixed(6)}`);
  }
}

function loadWallet(walletEnv: string, requireKey: boolean): { privateKey?: `0x${string}`; address?: `0x${string}` } {
  const privateKey = process.env[walletEnv];
  if (!privateKey) {
    if (requireKey) throw new Error(`Missing wallet private key env var: ${walletEnv}`);
    return {};
  }
  if (!privateKey.startsWith("0x")) throw new Error(`${walletEnv} must be a 0x-prefixed private key.`);
  return { privateKey: privateKey as `0x${string}`, address: privateKeyToAccount(privateKey as `0x${string}`).address };
}

async function appendLedger(entry: LedgerEntry): Promise<void> {
  const ledgerPath = path.resolve("examples/x402-real-buyer/ledger/x402-ledger.json");
  await fs.mkdir(path.dirname(ledgerPath), { recursive: true });
  let entries: LedgerEntry[] = [];
  try {
    entries = JSON.parse(await fs.readFile(ledgerPath, "utf8")) as LedgerEntry[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  entries.push(entry);
  await fs.writeFile(ledgerPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

function extractTxHash(settleResponse: SettleResponse | undefined): string | undefined {
  const response = settleResponse as unknown as { transaction?: string; txHash?: string; transactionHash?: string };
  return response?.transaction ?? response?.txHash ?? response?.transactionHash;
}

function printRequirement(requirement: PaymentRequirements, paymentRequired: PaymentRequired): void {
  console.log("Payment requirement:");
  console.log(JSON.stringify({
    x402Version: paymentRequired.x402Version,
    scheme: requirement.scheme,
    network: requirement.network,
    amount: requirementAmountAtomic(requirement),
    estimatedUsd: estimateUsd(requirement),
    asset: requirement.asset,
    recipient: requirementPayTo(requirement),
    maxTimeoutSeconds: requirement.maxTimeoutSeconds,
    extra: requirement.extra,
    facilitator: (paymentRequired as unknown as { facilitator?: unknown }).facilitator
  }, null, 2));
}

async function run(): Promise<void> {
  const args = readArgs(process.argv.slice(2));
  const mode = resolveMode(args);
  const endpoint = args.endpoint ?? process.env.X402_DEFAULT_ENDPOINT ?? DEFAULT_ENDPOINTS[0];
  const selectedNetwork = normalizeNetwork(args.network ?? process.env.X402_NETWORK ?? "base-sepolia");
  const requestUrl = endpointWithQuery(endpoint, args.query);
  const wallet = loadWallet(args.walletEnv, mode !== "dry-run");

  assertEndpointAllowed(endpoint);
  assertNetworkAllowed(selectedNetwork);

  console.log("x402 real buyer example");
  console.log(`Mode: ${mode}`);
  console.log(`Wallet address: ${wallet.address ?? "(not loaded; dry-run does not sign)"}`);
  console.log(`Network: ${selectedNetwork}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Max budget: $${args.budget.toFixed(2)}`);

  const unpaidResponse = await fetch(requestUrl);
  if (unpaidResponse.status !== 402) {
    const body = await readJsonBody(unpaidResponse);
    console.log(`Endpoint returned HTTP ${unpaidResponse.status}; no x402 payment requirement was returned.`);
    console.log(JSON.stringify(body, null, 2));
    await appendLedger({
      query: args.query,
      endpoint,
      mode,
      network: selectedNetwork,
      walletAddress: wallet.address,
      timestamp: new Date().toISOString(),
      status: "blocked",
      error: `Expected HTTP 402, received HTTP ${unpaidResponse.status}`
    });
    return;
  }

  const { paymentRequired, body } = await parsePaymentRequired(unpaidResponse);
  if (!paymentRequired) {
    console.log("HTTP 402 was returned, but no parseable x402 payment requirement was found.");
    console.log(JSON.stringify(body, null, 2));
    await appendLedger({
      query: args.query,
      endpoint,
      mode,
      network: selectedNetwork,
      walletAddress: wallet.address,
      timestamp: new Date().toISOString(),
      status: "blocked",
      error: "HTTP 402 did not include a parseable x402 payment requirement"
    });
    return;
  }

  const requirement = selectedRequirement(paymentRequired, selectedNetwork);
  assertNetworkAllowed(requirement.network);
  printRequirement(requirement, paymentRequired);
  assertBudget(requirement, args.budget);

  if (mode === "dry-run") {
    console.log("Dry-run complete. No signing, no transaction, and no paid retry were performed.");
    await appendLedger({
      query: args.query,
      endpoint,
      mode,
      network: requirement.network,
      asset: requirement.asset,
      amount: requirementAmountAtomic(requirement),
      walletAddress: wallet.address,
      timestamp: new Date().toISOString(),
      status: "dry-run"
    });
    return;
  }

  if (!wallet.privateKey) throw new Error(`Missing ${args.walletEnv}; real payment mode cannot sign without a private key.`);

  const account = privateKeyToAccount(wallet.privateKey);
  const client = new x402Client().register(
    requirement.network,
    new ExactEvmScheme(account, process.env.X402_RPC_URL ? { rpcUrl: process.env.X402_RPC_URL } : undefined)
  );
  let settleResponse: SettleResponse | undefined;
  client.onPaymentResponse(async (context) => {
    settleResponse = context.settleResponse;
  });

  const fetchWithPayment = wrapFetchWithPayment(fetch, client);
  const paidResponse = await fetchWithPayment(requestUrl);
  const paidBody = await readJsonBody(paidResponse);

  console.log(`Paid retry returned HTTP ${paidResponse.status}`);
  console.log(JSON.stringify(paidBody, null, 2));

  const txHash = extractTxHash(settleResponse);
  const paid = paidResponse.ok && Boolean(txHash || settleResponse);
  await appendLedger({
    query: args.query,
    endpoint,
    mode,
    network: requirement.network,
    asset: requirement.asset,
    amount: requirementAmountAtomic(requirement),
    walletAddress: wallet.address,
    txHash,
    facilitatorReceipt: settleResponse,
    timestamp: new Date().toISOString(),
    status: paid ? "paid" : "failed",
    error: paid ? undefined : "Paid retry did not return a settlement proof; not claiming payment success."
  });

  if (!paid) throw new Error("Paid retry completed without settlement proof; not claiming payment success.");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
