/**
 * A LIVE receipt from the mainnet mirror node — real data, end to end:
 *
 *     fetch a real transaction  →  fromMirror  →  receiptFor  →  text / HTML / PDF
 *
 *   node examples/live-receipt.ts            # the network's latest transfer
 *   node examples/live-receipt.ts 0.0.1234   # a specific account's latest
 *
 * This fetches with plain `fetch` to stay dependency-free. In an app you'd use
 * @hiero-enterprise/mirror, which returns the SAME objects used below:
 *
 *   const { transactions } = await client.queryTransactionsByAccount(account);
 *   const { currentRate }  = await client.queryExchangeRates({ timestamp: tx.consensus_timestamp });
 *   const info             = await client.queryTokenById(tokenId); // for decimals
 *
 * Run `npm run build` first (this imports the built library from dist/).
 */
import { writeFileSync } from "node:fs";
import { receiptFor, toText, toHTML } from "../dist/index.js";
import { fromMirror } from "../dist/adapters/mirror.js";
import { usdPriceFromExchangeRate } from "../dist/adapters/exchange-rate.js";
import { htmlToPdf } from "./render-pdf.js";

const MIRROR = "https://mainnet-public.mirrornode.hedera.com";
const account = process.argv[2];

async function get(path: string): Promise<any> {
  const res = await fetch(`${MIRROR}${path}`);
  if (!res.ok) throw new Error(`mirror node returned ${res.status} for ${path}`);
  return res.json();
}

// Account number, for skipping node/system accounts (< 0.0.100) when guessing
// whose receipt to show.
const accountNum = (id: string): number => Number(id.split(".").pop());

try {
  // 1. A real transaction — a tracked account's latest, or (for the network
  //    view) the most meaningful of the recent ones, so the demo isn't dust.
  const limit = account ? 1 : 100;
  const query = `${account ? `account.id=${account}&` : ""}transactiontype=cryptotransfer&limit=${limit}&order=desc`;
  const { transactions } = await get(`/api/v1/transactions?${query}`);
  if (!transactions?.length) {
    console.log(`No recent crypto transfers${account ? ` for ${account}` : ""}.`);
    process.exit(0);
  }
  const biggestLeg = (t: any): number => Math.max(0, ...t.transfers.map((x: any) => Math.abs(x.amount)));
  const tx = account ? transactions[0] : transactions.reduce((a: any, b: any) => (biggestLeg(b) > biggestLeg(a) ? b : a));

  // 2. The exchange rate IN EFFECT AT the transaction's timestamp — not now.
  const { current_rate } = await get(`/api/v1/network/exchangerate?timestamp=${tx.consensus_timestamp}`);
  const prices = usdPriceFromExchangeRate({
    hbarEquivalent: current_rate.hbar_equivalent,
    centEquivalent: current_rate.cent_equivalent,
  });

  // 3. Real decimals for any tokens involved, so amounts render readably.
  const decimals = new Map<string, number>();
  for (const leg of tx.token_transfers ?? []) {
    if (decimals.has(leg.token_id)) continue;
    const info = await get(`/api/v1/tokens/${leg.token_id}`).catch(() => null);
    if (info?.decimals != null) decimals.set(leg.token_id, Number(info.decimals));
  }

  // 4. Whose receipt? The account you asked for, else the most-affected real
  //    (non-system) account in the transaction.
  const byImpact = [...tx.transfers].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const subject = account ?? (byImpact.find((t) => accountNum(t.account) >= 100) ?? byImpact[0]).account;

  const receipt = receiptFor(subject, fromMirror(tx), { prices });

  console.log(`LIVE from mainnet — transaction ${tx.transaction_id}\n`);
  console.log(toText(receipt, decimals));

  // 5. Render it: HTML now, PDF via a headless browser (the caller's step).
  const html = toHTML(receipt, decimals);
  writeFileSync("live.receipt.html", html);
  const pdf = htmlToPdf(html, "live.receipt.pdf");
  console.log(`\nwrote live.receipt.html${pdf ? " and live.receipt.pdf" : ""}`);
} catch (err) {
  console.error(`\nCould not read live data: ${err instanceof Error ? err.message : err}`);
  console.error("(this example needs network access to the mainnet mirror node)");
  process.exit(1);
}
