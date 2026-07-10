export type PaymentProtocol = "mock-mpp" | "mock-x402";
export type SearchProvider = "mock" | "tavily" | "exa" | "brave";

export type PaymentRequirement = {
  protocol: PaymentProtocol;
  amount: string;
  currency: string;
  recipient: string;
  invoiceId: string;
  expiresAt: string;
  paymentHeader: "x-agent-payment";
  memo: string;
};

export type PaymentReceipt = {
  protocol: PaymentProtocol;
  amount: string;
  currency: string;
  invoiceId: string;
  payer: string;
  txId: string;
  paidAt: string;
  signature: "mock-paid";
};

export type LedgerEntry = {
  query: string;
  amount: string;
  protocol: PaymentProtocol;
  timestamp: string;
  invoiceId: string;
  txId: string;
};

export type PremiumSearchResult = {
  query: string;
  summary: string;
  provider: SearchProvider;
  sources: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  paid: true;
  ledgerEntry: LedgerEntry;
};
