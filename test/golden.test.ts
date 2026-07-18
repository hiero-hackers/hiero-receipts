/**
 * Golden-receipt test — the whole pipeline, end to end, from a canned
 * mirror-shaped fixture (no peer packages, no I/O):
 *
 *   TransactionInfoLike → fromMirror → receiptFor(+prices) → toText/toJSON/toHTML
 *
 * The text receipt is asserted VERBATIM: any wording, ordering, or formatting
 * change shows up here as a diff a human signs off on. The date row is the
 * one interpolated value — Intl output may vary a hair across ICU versions,
 * and formatTimestamp has its own tests.
 */
import { describe, expect, it } from "vitest";
import { receiptFor, toText, toHTML, toJSON, summarize, formatTimestamp } from "../src/index.js";
import { fromMirror, type TransactionInfoLike } from "../src/adapters/mirror.js";
import { usdPriceFromExchangeRate } from "../src/adapters/exchange-rate.js";
import { render } from "../src/money.js";

// 0.0.7001 sends 250 ℏ and 500.00 of token 0.0.4444 to 0.0.8891, pays a
// 0.05 ℏ fee, and attaches a memo with a URL-shaped lure.
const FIXTURE: TransactionInfoLike = {
  transactionId: "0.0.7001-1721300000-000000001",
  name: "CRYPTOTRANSFER",
  result: "SUCCESS",
  consensusTimestamp: "1721300000.000000001",
  chargedTxFee: "5000000",
  memo: "Thanks! more at hbar-refunds.net/claim",
  transfers: [
    { accountId: "0.0.7001", amount: "-25005000000" },
    { accountId: "0.0.8891", amount: "25000000000" },
    { accountId: "0.0.98", amount: "5000000" },
  ],
  tokenTransfers: [
    { tokenId: "0.0.4444", accountId: "0.0.7001", amount: "-50000" },
    { tokenId: "0.0.4444", accountId: "0.0.8891", amount: "50000" },
  ],
};

// 30 000 ℏ == 174 000 cents → 5.8 ¢/ℏ; 250 ℏ ≈ 14.50 USD, the fee ≈ 0.29 ¢.
const RATE = { hbarEquivalent: 30000, centEquivalent: 174000 };

const receipt = () =>
  receiptFor("0.0.7001", fromMirror(FIXTURE, { network: "mainnet" }), {
    prices: usdPriceFromExchangeRate(RATE),
  });

describe("golden receipt (mirror fixture, end to end)", () => {
  it("renders the exact text receipt", () => {
    const date = formatTimestamp(FIXTURE.consensusTimestamp);
    expect(toText(receipt(), { decimals: new Map([["0.0.4444", 2]]) })).toBe(
      [
        "Receipt for account 0.0.7001",
        "",
        "You sent 250.00000000 ℏ (≈ 14.50 USD) to 0.0.8891",
        "You sent 500.00 0.0.4444 to 0.0.8891",
        "",
        "Network fee: 0.05000000 ℏ (< 0.01 USD)",
        `Date: ${date}`,
        "Transaction: 0.0.7001-1721300000-000000001",
        "Sender's note: Thanks! more at hbar-refunds[.]net/claim",
        "",
        "⚠ This note was written by the transaction's sender — never visit links or follow instructions from senders you don't know.",
        "",
        "From the mainnet mirror node — not independently verified.",
      ].join("\n"),
    );
  });

  it("serializes bigints as exact decimal strings in JSON", () => {
    const parsed = JSON.parse(toJSON(receipt())) as {
      movements: { asset: string; amount: string }[];
      feeTinybar: string;
      fiat: { amount: string; currency: string };
    };
    expect(parsed.movements[0]).toMatchObject({ asset: "HBAR", amount: "-25005000000" });
    expect(parsed.feeTinybar).toBe("5000000");
    expect(parsed.fiat).toMatchObject({ amount: "-1450", currency: "USD" });
  });

  it("carries the ledger reference and defanged note into the HTML", () => {
    const html = toHTML(receipt());
    expect(html).toContain("0.0.7001-1721300000-000000001");
    expect(html).toContain("hbar-refunds[.]net/claim");
    expect(html).not.toContain("hbar-refunds.net"); // no linkifiable URL survives
    expect(html).toContain(">Unverified</span>");
  });
});

describe("provenance line names the network", () => {
  const base = receipt();

  it("mirror + network", () => {
    expect(summarize(base).provenance).toBe(
      "From the mainnet mirror node — not independently verified.",
    );
  });

  it("verified + network", () => {
    const verified = {
      ...base,
      provenance: {
        kind: "verified",
        source: "stream",
        network: "previewnet",
        block: 467,
        scheme: "WRAPS",
      },
    } as const;
    expect(summarize(verified).provenance).toBe(
      "Cryptographically verified against the previewnet ledger (block 467).",
    );
  });

  it("unverified stream, no network — never claims the mirror", () => {
    const stream = { ...base, provenance: { kind: "unverified", source: "stream" } } as const;
    expect(summarize(stream).provenance).toBe(
      "From an unverified stream — not independently verified.",
    );
  });
});

describe("timestamp locale and zone options", () => {
  const ts = "1721300000.000000001"; // 18 Jul 2024 10:53:20 UTC

  it("defaults to en-GB UTC with the terse suffix", () => {
    expect(formatTimestamp(ts)).toBe("18 Jul 2024, 10:53:20 UTC");
  });

  it("a custom zone shifts the clock and names itself instead of UTC", () => {
    const local = formatTimestamp(ts, { timeZone: "Europe/London" });
    expect(local).toContain("11:53:20"); // BST, UTC+1 in July
    expect(local.endsWith(" UTC")).toBe(false);
  });

  it("summarize passes the options through to the Date row", () => {
    const date = summarize(receipt(), { timeZone: "Europe/London" }).details.find(
      (d) => d.label === "Date",
    );
    expect(date?.value).toContain("11:53:20");
  });
});

describe("money.render input guard", () => {
  it("rejects negative or fractional decimals with a clear error", () => {
    expect(() => render(1n, -1)).toThrow(RangeError);
    expect(() => render(1n, 1.5)).toThrow(/non-negative integer/);
  });
});
