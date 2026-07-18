import { describe, it, expect } from "vitest";
import { receiptFor, toHTML, toText } from "../src/index.js";
import type { NormalizedTransaction } from "../src/normalized.js";

function tx(over: Partial<NormalizedTransaction> = {}): NormalizedTransaction {
  return {
    transactionId: "0.0.111@1.0",
    consensusTimestamp: "1783012345.000000000",
    txType: "cryptoTransfer",
    status: "success",
    payer: "0.0.111",
    feeTinybar: 0n,
    hbarTransfers: [{ account: "0.0.222", amount: 10_000_000_000n }],
    tokenTransfers: [],
    provenance: { kind: "unverified", source: "mirror" },
    ...over,
  };
}

/**
 * The memo is attacker-controlled: anyone can put anything in 100 bytes and
 * send you a transaction. `toHTML` output is meant for emails and PDFs, so an
 * unescaped memo is script injection into someone's inbox.
 *
 * The escaping is correct today. These tests exist so it stays that way — it is
 * currently correct only because nobody has touched the file.
 */
describe("toHTML escapes attacker-controlled content", () => {
  it("escapes a memo containing a script tag", () => {
    const html = toHTML(receiptFor("0.0.222", tx({ memo: "<script>alert(1)</script>" })));
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes an img onerror payload", () => {
    const html = toHTML(receiptFor("0.0.222", tx({ memo: '<img src=x onerror="steal()">' })));
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });

  it("escapes ampersands, so entities can't be smuggled in", () => {
    const html = toHTML(receiptFor("0.0.222", tx({ memo: "&lt;script&gt;" })));
    expect(html).toContain("&amp;lt;");
  });

  it("escapes a hostile account id", () => {
    const html = toHTML(
      receiptFor(
        "<b>0.0.222</b>",
        tx({ hbarTransfers: [{ account: "<b>0.0.222</b>", amount: 1n }] }),
      ),
    );
    expect(html).not.toContain("<b>0.0.222</b>");
    expect(html).toContain("&lt;b&gt;");
  });

  it("collapses control characters in a memo — a newline must not forge a receipt line", () => {
    // The text renderer is line-oriented (email / SMS): an embedded newline
    // would let a memo inject what looks like a genuine event line.
    const text = toText(receiptFor("0.0.222", tx({ memo: "hi\nYou received 999 \u210F" })));
    expect(text).not.toMatch(/^You received 999/m);
    expect(text).toContain("Sender's note: hi You received 999 \u210F");
  });

  it("leaves the real markup intact", () => {
    const html = toHTML(receiptFor("0.0.222", tx({ memo: "ordinary note" })));
    expect(html).toContain('<div class="rcpt">');
    expect(html).toContain("ordinary note");
  });
});

/**
 * Scam memos are the memo's dominant real-world use against strangers:
 * dust transactions carrying "claim your reward at …" — sent precisely
 * because explorers and wallets render them. A receipt must not lend the
 * scam its credibility: attribute authorship, break the one-tap path,
 * and warn. Policy stays with the caller (`memo: "warn" | "show" | "hide"`).
 */
describe("sender-note scam surface", () => {
  const SCAM = tx({
    memo: "You won 5000 HBAR! Claim at https://hbar-rewards.example or www.evil.site",
  });

  it("warn (default): attributes authorship, defangs links, and warns — in text", () => {
    const text = toText(receiptFor("0.0.222", SCAM));
    expect(text).toContain("Sender's note:");
    expect(text).not.toContain("Memo:");
    expect(text).toContain("hxxps://hbar-rewards[.]example");
    expect(text).toContain("www[.]evil[.]site");
    expect(text).not.toContain("https://hbar-rewards.example");
    expect(text).toContain("never visit links");
  });

  it("warn (default): same defenses in HTML, warning styled as a caution", () => {
    const html = toHTML(receiptFor("0.0.222", SCAM));
    expect(html).toContain("hxxps://hbar-rewards[.]example");
    expect(html).toContain('class="caution"');
    expect(html).toContain("never visit links");
  });

  it("bare domains with long TLDs — the crypto-scam favorites — are caught too", () => {
    // No https://, no www. — just the shapes .network/.finance/.capital
    // scams actually use. These must warn AND defang.
    const text = toText(
      receiptFor("0.0.222", tx({ memo: "claim at hbar-rewards.network/go or foo.finance" })),
    );
    expect(text).toContain("hbar-rewards[.]network/go");
    expect(text).toContain("foo[.]finance");
    expect(text).not.toContain("hbar-rewards.network");
    expect(text).toContain("never visit links");
  });

  it("a plain note gets attribution but no warning and no mangling", () => {
    const text = toText(receiptFor("0.0.222", tx({ memo: "thanks for lunch" })));
    expect(text).toContain("Sender's note: thanks for lunch");
    expect(text).not.toContain("never visit links");
  });

  it("hide: the note is omitted entirely", () => {
    const text = toText(receiptFor("0.0.222", SCAM), { memo: "hide" });
    expect(text).not.toContain("Sender's note");
    expect(text).not.toContain("hbar-rewards");
  });

  it("show: the note is untouched apart from control-character collapsing", () => {
    const text = toText(receiptFor("0.0.222", SCAM), { memo: "show" });
    expect(text).toContain("https://hbar-rewards.example");
    expect(text).not.toContain("never visit links");
  });
});

describe("toHTML provenance badge", () => {
  it("says Unverified for a mirror receipt", () => {
    expect(toHTML(receiptFor("0.0.222", tx()))).toContain(">Unverified<");
  });

  it("says Verified only when the provenance is verified", () => {
    const verified = tx({
      provenance: { kind: "verified", source: "stream", block: 467, scheme: "WRAPS" },
    });
    const html = toHTML(receiptFor("0.0.222", verified));
    expect(html).toContain(">Verified<");
    expect(html).toContain("badge ok");
  });

  it("is self-contained — no external assets to leak or fail to load in email", () => {
    const html = toHTML(receiptFor("0.0.222", tx()));
    expect(html).not.toMatch(/src=["']https?:/);
    expect(html).not.toMatch(/<link|<img|@import/);
  });
});
