import { listLedgerEntries, resetLedger } from "./ledger.js";

async function run(): Promise<void> {
  if (process.argv.includes("--reset")) {
    await resetLedger();
    console.log("Ledger reset.");
    return;
  }

  const entries = await listLedgerEntries();
  console.table(entries);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
