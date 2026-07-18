import type { Receipt } from "../receipt.js";
import type { SummaryOptions } from "../summary.js";
import { summarize } from "../summary.js";
import { en } from "../messages.js";

/**
 * A plain-text receipt in everyday language (email / SMS / log). Pass
 * `{ decimals }` for readable token amounts and `{ memo }` to set the
 * sender-note policy. Degrades gracefully when optional details (memo,
 * fiat) are absent.
 */
export function toText(receipt: Receipt, opts: SummaryOptions = {}): string {
  const s = summarize(receipt, opts);
  const lines = [(opts.messages ?? en).receiptForAccount(receipt.account), ""];
  for (const event of s.events) lines.push(event);
  if (s.statusNote) lines.push(s.statusNote);
  lines.push("");
  for (const d of s.details) lines.push(`${d.label}: ${d.value}`);
  if (s.memoWarning) lines.push("", `⚠ ${s.memoWarning}`);
  lines.push("", s.provenance);
  return lines.join("\n");
}
