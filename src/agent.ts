import { config } from "./config.js";
import { encodeReceipt, simulatePayment } from "./payment.js";
import type { PaymentRequirement, PremiumSearchResult } from "./types.js";

type AgentArgs = {
  query: string;
  maxBudget: number;
};

function readArgs(argv: string[]): AgentArgs {
  const budgetFlagIndex = argv.findIndex((arg) => arg === "--budget" || arg === "-b");
  const maxBudget = budgetFlagIndex >= 0 ? Number(argv[budgetFlagIndex + 1]) : 0.05;
  const queryParts = argv.filter((arg, index) => {
    return index !== budgetFlagIndex && index !== budgetFlagIndex + 1 && arg !== "--budget" && arg !== "-b" && arg !== "--";
  });
  const query = queryParts.join(" ").trim();

  if (!query || Number.isNaN(maxBudget)) {
    throw new Error('Usage: npm run agent -- "research query" --budget 0.05');
  }

  return { query, maxBudget };
}

async function callPremiumSearch(query: string, paymentHeader?: string): Promise<Response> {
  return fetch(`${config.apiBaseUrl}/api/premium-search`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(paymentHeader ? { "x-agent-payment": paymentHeader } : {})
    },
    body: JSON.stringify({ query })
  });
}

async function run(): Promise<void> {
  const args = readArgs(process.argv.slice(2));
  console.log(`User query: ${args.query}`);
  console.log(`Max budget: ${args.maxBudget.toFixed(2)} ${config.paymentCurrency}`);

  const firstResponse = await callPremiumSearch(args.query);

  if (firstResponse.status !== 402) {
    throw new Error(`Expected HTTP 402 from unpaid request, received ${firstResponse.status}`);
  }

  const unpaidBody = (await firstResponse.json()) as {
    paymentRequired: PaymentRequirement;
    reason: string;
  };
  const requirement = unpaidBody.paymentRequired;
  const requiredAmount = Number(requirement.amount);

  console.log(`API returned 402: ${unpaidBody.reason}`);
  console.log(`Payment required: ${requirement.amount} ${requirement.currency} via ${requirement.protocol}`);

  if (requiredAmount > args.maxBudget) {
    throw new Error(
      `Budget check failed: required ${requirement.amount} ${requirement.currency}, max ${args.maxBudget.toFixed(2)}`
    );
  }

  const receipt = simulatePayment(requirement);
  const paidResponse = await callPremiumSearch(args.query, encodeReceipt(receipt));

  if (!paidResponse.ok) {
    throw new Error(`Paid retry failed with HTTP ${paidResponse.status}: ${await paidResponse.text()}`);
  }

  const result = (await paidResponse.json()) as PremiumSearchResult;

  console.log("Payment simulated. Retried with x-agent-payment header.");
  console.log(JSON.stringify(result, null, 2));
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
