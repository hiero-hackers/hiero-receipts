import type { Receipt } from "../receipt.js";
import { summarize } from "../summary.js";

/**
 * A plain-text receipt in everyday language (email / SMS / log). Pass a
 * `decimals` map for readable token amounts. Degrades gracefully when
 * optional details (memo, fiat) are absent.
 */
export function toText(receipt: Receipt, decimals: Map<string, number> = new Map()): string {
  const s = summarize(receipt, { decimals });
  const lines = [`Receipt for account ${receipt.account}`, ""];
  for (const event of s.events) lines.push(event);
  if (s.statusNote) lines.push(s.statusNote);
  lines.push("");
  for (const d of s.details) lines.push(`${d.label}: ${d.value}`);
  lines.push("", s.provenance);
  return lines.join("\n");
}
