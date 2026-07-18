/**
 * A LIVE receipt — reads a real transaction from mainnet through
 * @hiero-hackers/enterprise-mirror, then turns it into a receipt:
 *
 *   MirrorNodeClient  →  fromMirror  →  receiptFor  →  text / HTML / PDF
 *
 *   node examples/live-receipt.ts            # a real recent mainnet transfer
 *   node examples/live-receipt.ts 0.0.1234   # a specific account's latest
 *
 * First: `npm run build && npm run examples:setup` (built library from
 * dist/, peer packages from GitHub Packages).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createMirrorNodeClient } from "@hiero-hackers/enterprise-mirror";
import { receiptFor, toText, toHTML } from "../dist/index.js";
import { fromMirror } from "../dist/adapters/mirror.js";
import { usdPriceFromExchangeRate } from "../dist/adapters/exchange-rate.js";
import { htmlToPdf } from "./render-pdf.js";

const mirror = createMirrorNodeClient({ network: "mainnet" });
const account = process.argv[2];
const accountNum = (id: string): number => Number(id.split(".").pop());

try {
  // 1. Real transactions via the enterprise client — a tracked account's
  //    latest, or (network-wide) the biggest of the recent ones so the demo
  //    isn't a dust probe.
  const page = account
    ? await mirror.queryTransactionsByAccount(account, {
        transactionType: "CRYPTOTRANSFER",
        limit: 1,
        order: "desc",
      })
    : await mirror.queryTransactions({
        transactionType: "CRYPTOTRANSFER",
        limit: 100,
        order: "desc",
      });
  if (!page.data.length) {
    console.log(`No recent crypto transfers${account ? ` for ${account}` : ""}.`);
    process.exit(0);
  }
  const biggest = (t: (typeof page.data)[number]): number =>
    Math.max(0, ...t.transfers.map((x) => Math.abs(x.amount)));
  const tx = account
    ? page.data[0]!
    : page.data.reduce((a, b) => (biggest(b) > biggest(a) ? b : a));

  // 2. The exchange rate. For a recent transaction the current rate is the one
  //    in effect; for a historical one, pass { timestamp: { lte: tx.consensusTimestamp } }.
  const { currentRate } = await mirror.queryExchangeRates();
  const prices = usdPriceFromExchangeRate(currentRate);

  // 3. Real decimals for any tokens involved, so amounts render readably.
  const decimals = new Map<string, number>();
  for (const leg of tx.tokenTransfers) {
    if (decimals.has(leg.tokenId)) continue;
    const info = await mirror.queryTokenById(leg.tokenId).catch(() => null);
    if (info?.decimals != null) decimals.set(leg.tokenId, Number(info.decimals));
  }

  // 4. Whose receipt? The account you asked for, else the most-affected real
  //    (non-system) account in the transaction.
  const byImpact = [...tx.transfers].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const subject =
    account ?? (byImpact.find((t) => accountNum(t.accountId) >= 100) ?? byImpact[0]!).accountId;

  const receipt = receiptFor(subject, fromMirror(tx, { network: "mainnet" }), { prices });

  console.log(`LIVE from mainnet (via @hiero-hackers/enterprise-mirror) — ${tx.transactionId}\n`);
  console.log(toText(receipt, { decimals }));

  // 5. Render it into examples/output/: HTML now, PDF via a headless browser.
  const outDir = fileURLToPath(new URL("./output/", import.meta.url));
  mkdirSync(outDir, { recursive: true });
  const html = toHTML(receipt, { decimals });
  const htmlPath = join(outDir, "live.receipt.html");
  const pdfPath = join(outDir, "live.receipt.pdf");
  writeFileSync(htmlPath, html);
  const pdf = htmlToPdf(html, pdfPath);
  const shown = (p: string): string => relative(process.cwd(), p);
  console.log(`\nwrote ${shown(htmlPath)}${pdf ? ` and ${shown(pdfPath)}` : ""}`);
} catch (err) {
  console.error(`\nCould not read live data: ${err instanceof Error ? err.message : err}`);
  console.error("(this example needs network access to the mainnet mirror node)");
  process.exit(1);
}
