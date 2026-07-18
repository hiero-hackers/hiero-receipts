import type { Receipt } from "../receipt.js";
import type { SummaryOptions } from "../summary.js";
import { summarize } from "../summary.js";
import { en } from "../messages.js";

// Quotes included so the helper stays safe if a future edit interpolates
// into an attribute — today every use is element content.
const esc = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * A self-contained styled HTML receipt in everyday language (inline CSS, no
 * external assets — safe to embed in an email or print to PDF).
 */
export function toHTML(receipt: Receipt, opts: SummaryOptions = {}): string {
  const s = summarize(receipt, opts);
  const msgs = opts.messages ?? en;
  const verified = receipt.provenance.kind === "verified";

  const headline = esc(s.events[0] ?? "Receipt");
  const extraEvents = s.events
    .slice(1)
    .map((e) => `<li>${esc(e)}</li>`)
    .join("");
  const detailRows = s.details
    .map((d) => `<tr><td class="k">${esc(d.label)}</td><td class="v">${esc(d.value)}</td></tr>`)
    .join("");
  const status = s.statusNote ? `<p class="status">${esc(s.statusNote)}</p>` : "";
  const caution = s.memoWarning ? `<p class="caution">${esc(s.memoWarning)}</p>` : "";
  const badge = `<span class="badge${verified ? " ok" : ""}">${esc(verified ? msgs.verifiedBadge : msgs.unverifiedBadge)}</span>`;

  return `<style>
    .rcpt{max-width:420px;font:400 14px/1.5 system-ui,sans-serif;border:1px solid #d8dce2;border-radius:12px;padding:20px;color:#1a1d24;background:#fff}
    .rcpt .who{color:#5b6472;font-size:12px;margin:0 0 6px}
    .rcpt h3{margin:0 0 4px;font:600 18px/1.25 Georgia,serif}
    .rcpt ul{margin:2px 0 0;padding-left:18px;color:#3a4150}
    .rcpt .status{color:#b3261e;font-size:13px;margin:10px 0 0}
    .rcpt .caution{color:#7a5c12;background:#faf3e0;border-radius:8px;padding:8px 10px;font-size:12px;margin:12px 0 0}
    .rcpt table{width:100%;border-collapse:collapse;margin-top:14px}
    .rcpt td{padding:5px 0;border-bottom:1px solid #eef0f3;vertical-align:top}
    .rcpt td.k{color:#5b6472;width:40%}
    .rcpt td.v{text-align:right;font-family:ui-monospace,Menlo,monospace}
    .rcpt .prov{color:#5b6472;font-size:12px;margin:14px 0 0}
    .rcpt .badge{display:inline-block;margin-left:6px;padding:2px 8px;border-radius:100px;font:600 10px/1.4 system-ui;text-transform:uppercase;letter-spacing:.04em;background:#f0f1f3;color:#5b6472;vertical-align:middle}
    .rcpt .badge.ok{background:#e3f0ec;color:#1f6f5c}
    @media print{@page{margin:18mm}html,body{background:#fff}.rcpt{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style>
  <div class="rcpt">
    <p class="who">${esc(msgs.receiptFor(receipt.account))}</p>
    <h3>${headline}</h3>
    ${extraEvents ? `<ul>${extraEvents}</ul>` : ""}
    ${status}
    <table>${detailRows}</table>
    ${caution}
    <p class="prov">${esc(s.provenance)}${badge}</p>
  </div>`;
}
