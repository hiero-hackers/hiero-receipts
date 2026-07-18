/**
 * i18n of receipt wording — the Messages catalog. English is pinned
 * verbatim in golden.test.ts; here the German catalog gets the same
 * treatment (word order, decimal commas, network attachment), Spanish gets
 * spot checks, and the customization path (spread a catalog, override one
 * entry) is exercised.
 */
import { describe, expect, it } from "vitest";
import { receiptFor, toText, toHTML, summarize, formatTimestamp } from "../src/index.js";
import { fromMirror, type TransactionInfoLike } from "../src/adapters/mirror.js";
import { usdPriceFromExchangeRate } from "../src/adapters/exchange-rate.js";
import { de } from "../src/locales/de.js";
import { es } from "../src/locales/es.js";
import { en } from "../src/messages.js";

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

const receipt = () =>
  receiptFor("0.0.7001", fromMirror(FIXTURE, { network: "mainnet" }), {
    prices: usdPriceFromExchangeRate({ hbarEquivalent: 30000, centEquivalent: 174000 }),
  });

describe("German receipt (de)", () => {
  it("renders the exact text receipt — verb-final, decimal commas", () => {
    const date = formatTimestamp(FIXTURE.consensusTimestamp, { locale: "de-DE" });
    expect(toText(receipt(), { messages: de, decimals: new Map([["0.0.4444", 2]]) })).toBe(
      [
        "Beleg für Konto 0.0.7001",
        "",
        "Sie haben 250,00000000 ℏ (≈ 14,50 USD) an 0.0.8891 gesendet",
        "Sie haben 500,00 0.0.4444 an 0.0.8891 gesendet",
        "",
        `Netzwerkgebühr: 0,05000000 ℏ (< 0,01 USD)`,
        `Datum: ${date}`,
        "Transaktion: 0.0.7001-1721300000-000000001",
        "Notiz des Absenders: Thanks! more at hbar-refunds[.]net/claim",
        "",
        "⚠ Diese Notiz stammt vom Absender der Transaktion — besuchen Sie niemals Links und folgen Sie keinen Anweisungen von Absendern, die Sie nicht kennen.",
        "",
        "Vom mainnet-Mirror-Node — nicht unabhängig verifiziert.",
      ].join("\n"),
    );
  });

  it("localizes the HTML badge and who-line", () => {
    const html = toHTML(receipt(), { messages: de });
    expect(html).toContain(">Nicht verifiziert</span>");
    expect(html).toContain("Beleg für 0.0.7001");
  });

  it("the catalog's locale drives dates unless overridden", () => {
    const summary = summarize(receipt(), { messages: de });
    const date = summary.details.find((d) => d.label === "Datum")?.value;
    expect(date).toBe(formatTimestamp(FIXTURE.consensusTimestamp, { locale: "de-DE" }));
  });
});

describe("Spanish receipt (es)", () => {
  it("speaks Spanish end to end", () => {
    const s = summarize(receipt(), { messages: es });
    expect(s.events[0]).toBe("Enviaste 250,00000000 ℏ (≈ 14,50 USD) a 0.0.8891");
    expect(s.provenance).toBe("Del mirror node de mainnet — sin verificación independiente.");
    expect(s.details.map((d) => d.label)).toContain("Comisión de red");
  });
});

describe("customization", () => {
  it("spreading a catalog overrides a single sentence", () => {
    const custom = { ...en, noChange: "Nothing happened." };
    const quiet = receiptFor(
      "0.0.5555",
      fromMirror({ ...FIXTURE, transfers: [], tokenTransfers: [], memo: undefined }),
    );
    expect(summarize(quiet, { messages: custom }).events[0]).toBe("Nothing happened.");
  });

  it("explicit locale overrides the catalog's own (numbers and dates)", () => {
    const s = summarize(receipt(), { messages: de, locale: "en-GB" });
    expect(s.events[0]).toBe("Sie haben 250.00000000 ℏ (≈ 14.50 USD) an 0.0.8891 gesendet");
  });
});
