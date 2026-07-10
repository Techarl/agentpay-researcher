import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import type { LedgerEntry } from "./types.js";

async function readLedger(): Promise<LedgerEntry[]> {
  try {
    const raw = await fs.readFile(config.ledgerPath, "utf8");
    return JSON.parse(raw) as LedgerEntry[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function appendLedgerEntry(entry: LedgerEntry): Promise<LedgerEntry> {
  const ledger = await readLedger();
  ledger.push(entry);
  await fs.mkdir(path.dirname(config.ledgerPath), { recursive: true });
  await fs.writeFile(config.ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  return entry;
}

export async function listLedgerEntries(): Promise<LedgerEntry[]> {
  return readLedger();
}

export async function resetLedger(): Promise<void> {
  await fs.mkdir(path.dirname(config.ledgerPath), { recursive: true });
  await fs.writeFile(config.ledgerPath, "[]\n", "utf8");
}
