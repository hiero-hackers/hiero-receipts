/**
 * Property-based tests for the parts that are FACT — exact arithmetic that
 * must hold for *every* input, not just the hand-picked examples. Each test
 * generates thousands of random cases and asserts an invariant.
 *
 * (Heuristics — counterparty, "internal" direction — are pinned in
 * generate.test.ts and are explicitly NOT asserted as universal truths.)
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { render, TINYBAR_PER_HBAR } from "../src/index.js";
import { receiptFor } from "../src/index.js";
import { usdPriceFromExchangeRate } from "../src/adapters/exchange-rate.js";
import type { NormalizedTransaction } from "../src/normalized.js";

// Reconstruct a bigint from render()'s output — the inverse of formatting.
function parseRendered(s: string, decimals: number): bigint {
  const neg = s.startsWith("-");
  const body = (neg ? s.slice(1) : s).trim();
  const [whole, frac = ""] = body.split(".");
  const scaled = BigInt(whole ?? "0") * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0");
  return neg ? -scaled : scaled;
}

describe("FACT: exact formatting (no float, round-trips)", () => {
  it("render() is a lossless integer split for any amount and scale", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -(10n ** 30n), max: 10n ** 30n }), fc.integer({ min: 0, max: 18 }), (amount, decimals) => {
        expect(parseRendered(render(amount, decimals), decimals)).toBe(amount);
      }),
    );
  });

  it("survives amounts beyond 2^53 (where a float would lose precision)", () => {
    const huge = 9_007_199_254_740_993n; // 2^53 + 1
    expect(parseRendered(render(huge, 8), 8)).toBe(huge);
  });
});

describe("FACT: transfer conservation — the sender's amount equals the receiver's", () => {
  it("what A is shown sending is exactly what B is shown receiving", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 10n ** 24n }), // principal (tinybar), can exceed 2^53
        fc.bigInt({ min: 0n, max: 10n ** 9n }), // fee
        (principal, fee) => {
          const tx: NormalizedTransaction = {
            transactionId: "0.0.1@1.0",
            consensusTimestamp: "1.0",
            txType: "cryptoTransfer",
            status: "success",
            payer: "0.0.1",
            feeTinybar: fee,
            hbarTransfers: [
              { account: "0.0.1", amount: -(principal + fee) }, // sender pays principal + fee
              { account: "0.0.2", amount: principal }, // receiver
              { account: "0.0.98", amount: fee }, // fee collector
            ],
            tokenTransfers: [],
            provenance: { kind: "unverified", source: "mirror" },
          };
          const sender = receiptFor("0.0.1", tx);
          const receiver = receiptFor("0.0.2", tx);
          // Sender's net + fee back out = -(principal); receiver's net = principal.
          const senderNet = sender.movements.find((m) => m.kind === "hbar")?.amount ?? 0n;
          const receiverNet = receiver.movements.find((m) => m.kind === "hbar")?.amount ?? 0n;
          expect(-(senderNet + sender.feeTinybar)).toBe(principal); // amount sent, fee excluded
          expect(receiverNet).toBe(principal); // amount received
          // The fee the payer bore is exactly the transaction fee; the receiver bears none.
          expect(sender.feeTinybar).toBe(fee);
          expect(receiver.feeTinybar).toBe(0n);
        },
      ),
    );
  });
});

describe("FACT: exchange-rate valuation is exact and monotonic", () => {
  const rate = { hbarEquivalent: 30_000, centEquivalent: 154_000 };
  const prices = usdPriceFromExchangeRate(rate);

  it("equals the exact rational formula, for any amount (incl. > 2^53)", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 20n }), (tinybar) => {
        const expected = (tinybar * 154_000n) / (30_000n * TINYBAR_PER_HBAR);
        expect(prices.valueHbar(tinybar, "1.0")).toBe(expected);
      }),
    );
  });

  it("never decreases as the amount grows (a positive rate)", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 18n }), fc.bigInt({ min: 0n, max: 10n ** 18n }), (a, b) => {
        const lo = a < b ? a : b;
        const hi = a < b ? b : a;
        expect(prices.valueHbar(lo, "1.0")! <= prices.valueHbar(hi, "1.0")!).toBe(true);
      }),
    );
  });

  it("values whole HBAR at exactly cents = ℏ · centEquivalent / hbarEquivalent", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 12n }), (wholeHbar) => {
        const tinybar = wholeHbar * TINYBAR_PER_HBAR;
        expect(prices.valueHbar(tinybar, "1.0")).toBe((wholeHbar * 154_000n) / 30_000n);
      }),
    );
  });
});
