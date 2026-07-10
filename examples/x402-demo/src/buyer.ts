import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment } from "x402-fetch";

const sellerUrl = process.env.SELLER_URL ?? "http://localhost:4021";
const privateKey = process.env.BUYER_PRIVATE_KEY;

if (!privateKey || privateKey.endsWith("0000000000000000000000000000000000000000000000000000000000000000")) {
  throw new Error("Set BUYER_PRIVATE_KEY to a funded testnet wallet before running the buyer.");
}

const account = privateKeyToAccount(privateKey as `0x${string}`);
const fetchWithPayment = wrapFetchWithPayment(fetch, account);

const response = await fetchWithPayment(`${sellerUrl}/premium-search?q=agent%20payment%20research`);

if (!response.ok) {
  throw new Error(`x402 buyer request failed with HTTP ${response.status}: ${await response.text()}`);
}

console.log(JSON.stringify(await response.json(), null, 2));
