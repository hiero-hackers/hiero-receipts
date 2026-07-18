/**
 * A VERIFIED receipt — from a cryptographically-proven block stream, via
 * @hiero-hackers/streams-node:
 *
 *   verifyBlockProofJson  →  parseBlockJson  →  fromStream  →  receiptFor
 *
 * Unlike the mirror path (operator-attested), this receipt's data is proven:
 * the block's in-band proof (recomputed merkle root + threshold signature) is
 * checked before the transaction is booked, so the receipt is stamped
 * `verified`. Runs against committed block fixtures — no network.
 *
 * Note the account ids look like `11.12.2`, not mainnet's `0.0.X`: these
 * fixtures are from the HIP-1056 block-stream PREVIEW network (block streams
 * aren't GA on mainnet yet). `shard.realm.num` with non-zero shard/realm is a
 * valid id — the receipt renders it as-is rather than assuming `0.0.`.
 *
 *   node examples/verified-receipt.ts       (Node 23.6+ runs .ts directly)
 *
 * First: `npm run build && npm run examples:setup` (built library from
 * dist/, peer packages from GitHub Packages).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseBlockJson, verifyBlockProofJson } from "@hiero-hackers/streams-node";
import { receiptFor, toText, toHTML } from "../dist/index.js";
import { fromStream } from "../dist/adapters/stream.js";
import type { BlockProofLike, ParsedTransactionLike } from "../dist/adapters/stream.js";
import { htmlToPdf } from "./render-pdf.js";

const fixture = (name: string): Buffer =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
const genesis = fixture("0.blk.gz");
const block = fixture("467.blk.gz");

// 1. VERIFY the block's in-band proof — this is what makes the receipt
//    "verified". A bad proof means we do not trust the data at all.
const proof = JSON.parse(verifyBlockProofJson(block, genesis)) as BlockProofLike;
if (!proof.valid) {
  console.error("block proof did NOT verify — refusing to build a receipt");
  process.exit(1);
}
const signers = proof.schnorr
  ? ` (${proof.schnorr.signerCount}/${proof.schnorr.totalNodes} signers)`
  : "";
console.log(`✓ block ${proof.blockNumber} verified — ${proof.proofPath}${signers}\n`);

// 2. Parse the block's transactions.
const { transactions } = JSON.parse(parseBlockJson(block)) as {
  transactions: ParsedTransactionLike[];
};

// 3. Pick the transaction with the largest HBAR movement, and its main party.
const biggest = (t: Pick<ParsedTransactionLike, "transfers">): bigint =>
  t.transfers.reduce((m, x) => {
    const a = BigInt(x.amount);
    const abs = a < 0n ? -a : a;
    return abs > m ? abs : m;
  }, 0n);
const tx = transactions.reduce((a, b) => (biggest(b) > biggest(a) ? b : a));
const subject = [...tx.transfers].sort((a, b) =>
  biggest({ transfers: [b] }) > biggest({ transfers: [a] }) ? 1 : -1,
)[0]!.account;

// 4. Build the receipt — the proof stamps it `verified`. The fixtures are
//    from the HIP-1056 block-stream preview network; naming the network keeps
//    this receipt from reading like a mainnet one.
const receipt = receiptFor(subject, fromStream(tx, proof, { network: "previewnet" }));
console.log(toText(receipt));

// 5. Render it (HTML + PDF) into examples/output/, wherever we're run from.
const outDir = fileURLToPath(new URL("./output/", import.meta.url));
mkdirSync(outDir, { recursive: true });
const html = toHTML(receipt);
const htmlPath = join(outDir, "verified.receipt.html");
const pdfPath = join(outDir, "verified.receipt.pdf");
writeFileSync(htmlPath, html);
const pdf = htmlToPdf(html, pdfPath);
const shown = (p: string): string => relative(process.cwd(), p);
console.log(`\nwrote ${shown(htmlPath)}${pdf ? ` and ${shown(pdfPath)}` : ""}`);
