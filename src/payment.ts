import crypto from "node:crypto";
import { config } from "./config.js";
import type { PaymentProtocol, PaymentReceipt, PaymentRequirement } from "./types.js";

export function createInvoiceId(query: string): string {
  const digest = crypto.createHash("sha256").update(query.trim().toLowerCase()).digest("hex");
  return `mock_inv_${digest.slice(0, 18)}`;
}

export function createPaymentRequirement(query: string): PaymentRequirement {
  return {
    protocol: config.paymentProtocol,
    amount: config.premiumSearchPrice,
    currency: config.paymentCurrency,
    recipient: config.paymentRecipient,
    invoiceId: createInvoiceId(query),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    paymentHeader: "x-agent-payment",
    memo: `Premium research for: ${query}`
  };
}

export function encodeReceipt(receipt: PaymentReceipt): string {
  const payload = Buffer.from(JSON.stringify(receipt), "utf8").toString("base64url");
  return `${receipt.protocol} ${payload}`;
}

export function simulatePayment(requirement: PaymentRequirement, payer = "agentpay-demo-client"): PaymentReceipt {
  return {
    protocol: requirement.protocol,
    amount: requirement.amount,
    currency: requirement.currency,
    invoiceId: requirement.invoiceId,
    payer,
    txId: `mock_tx_${crypto.randomUUID()}`,
    paidAt: new Date().toISOString(),
    signature: "mock-paid"
  };
}

export function verifyPaymentHeader(
  paymentHeader: string | undefined,
  requirement: PaymentRequirement
): { ok: true; receipt: PaymentReceipt } | { ok: false; reason: string } {
  if (!paymentHeader) {
    return { ok: false, reason: "missing payment header" };
  }

  const [protocol, payload] = paymentHeader.split(" ");
  if ((protocol !== "mock-x402" && protocol !== "mock-mpp") || !payload) {
    return { ok: false, reason: "payment header must be '<mock protocol> <base64url receipt>'" };
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PaymentReceipt;
    const expected: Array<[boolean, string]> = [
      [decoded.protocol === protocol, "receipt protocol does not match header protocol"],
      [decoded.protocol === requirement.protocol, "receipt protocol does not match requirement"],
      [decoded.invoiceId === requirement.invoiceId, "receipt invoiceId does not match requirement"],
      [decoded.amount === requirement.amount, "receipt amount does not match requirement"],
      [decoded.currency === requirement.currency, "receipt currency does not match requirement"],
      [decoded.signature === "mock-paid", "receipt signature is not accepted"]
    ];
    const failure = expected.find(([valid]) => !valid);

    if (failure) {
      return { ok: false, reason: failure[1] };
    }

    return { ok: true, receipt: decoded };
  } catch {
    return { ok: false, reason: "payment receipt could not be decoded" };
  }
}

export function parseProtocol(value: string): PaymentProtocol {
  if (value !== "mock-x402" && value !== "mock-mpp") {
    throw new Error("Protocol must be mock-x402 or mock-mpp");
  }

  return value;
}
