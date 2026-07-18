/**
 * Tarball smoke test: `npm run test:pack`.
 *
 * The unit tests exercise the repo; this exercises the ARTIFACT. It runs
 * `npm pack`, installs the tarball into a throwaway project, and builds a
 * receipt through the published entry points — the only way to catch a
 * missing `files` entry, a broken exports condition, or a dist/ path typo
 * before a consumer does. No peer packages involved: the fixture is inline
 * and the adapters are structurally typed.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const scratch = mkdtempSync(join(tmpdir(), "hiero-receipts-pack-smoke-"));

try {
  // 1. Pack the real artifact (npm runs `prepare` → build first).
  // The `prepare` (build) script's output lands on stdout too — the tarball
  // filename is the LAST line.
  const tarball = execFileSync(npm, ["pack", "--pack-destination", scratch], {
    cwd: root,
    stdio: ["ignore", "pipe", "inherit"],
  })
    .toString()
    .trim()
    .split("\n")
    .pop();

  // 2. A minimal consumer project, installing from the tarball.
  writeFileSync(
    join(scratch, "package.json"),
    JSON.stringify({ name: "pack-smoke-consumer", private: true, type: "module" }),
  );
  execFileSync(npm, ["install", "--no-audit", "--no-fund", join(scratch, tarball)], {
    cwd: scratch,
    stdio: "inherit",
  });

  // 3. Import through the published entry points (root + subpath) and run
  //    the pipeline end to end.
  writeFileSync(
    join(scratch, "smoke.mjs"),
    `
import { receiptFor, toText, toHTML, toJSON } from "@hiero-hackers/hiero-receipts";
import { fromMirror } from "@hiero-hackers/hiero-receipts/mirror";
import { usdPriceFromExchangeRate } from "@hiero-hackers/hiero-receipts/exchange-rate";
import { de } from "@hiero-hackers/hiero-receipts/locales/de";

const tx = {
  transactionId: "0.0.7001-1721300000-000000001",
  name: "CRYPTOTRANSFER",
  result: "SUCCESS",
  consensusTimestamp: "1721300000.000000001",
  chargedTxFee: "5000000",
  transfers: [
    { accountId: "0.0.7001", amount: "-25005000000" },
    { accountId: "0.0.8891", amount: "25000000000" },
    { accountId: "0.0.98", amount: "5000000" },
  ],
  tokenTransfers: [],
};
const receipt = receiptFor("0.0.7001", fromMirror(tx, { network: "mainnet" }), {
  prices: usdPriceFromExchangeRate({ hbarEquivalent: 30000, centEquivalent: 174000 }),
});
const text = toText(receipt);
const assert = (cond, why) => {
  if (!cond) {
    console.error("SMOKE FAIL: " + why + "\\n---\\n" + text);
    process.exit(1);
  }
};
assert(text.includes("You sent 250.00000000 ℏ (≈ 14.50 USD) to 0.0.8891"), "transfer line");
assert(text.includes("Transaction: 0.0.7001-1721300000-000000001"), "ledger reference");
assert(text.includes("From the mainnet mirror node"), "provenance line");
assert(toHTML(receipt).includes(">Unverified</span>"), "HTML badge");
assert(JSON.parse(toJSON(receipt)).feeTinybar === "5000000", "JSON bigint string");
assert(toText(receipt, { messages: de }).includes("gesendet"), "locale subpath");
console.log("pack smoke: tarball installs and produces a correct receipt ✓");
`,
  );
  execFileSync(process.execPath, ["smoke.mjs"], { cwd: scratch, stdio: "inherit" });
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
