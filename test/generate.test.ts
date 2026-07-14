import { describe, it, expect } from "vitest";
import { receiptFor, toText, toJSON } from "../src/index.js";
import { fromMirror } from "../src/adapters/mirror.js";
import { usdPriceFromExchangeRate, usdPriceFromExchangeRates } from "../src/adapters/exchange-rate.js";
import type { NormalizedTransaction } from "../src/normalized.js";
import type { PriceSource } from "../src/prices.js";

const OUTGOING: NormalizedTransaction = {
  transactionId: "0.0.111@1783123259.905485000",
  consensusTimestamp: "1783123259.905485000",
  txType: "cryptoTransfer",
  status: "success",
  payer: "0.0.111",
  feeTinybar: 1_000_000n,
  hbarTransfers: [
    { account: "0.0.111", amount: -100_001_000_000n }, // sent 1000 ℏ + fee
    { account: "0.0.222", amount: 100_000_000_000n }, // received 1000 ℏ
    { account: "0.0.98", amount: 1_000_000n }, // fee collector
  ],
  tokenTransfers: [],
  provenance: { kind: "unverified", source: "mirror" },
};

describe("receiptFor", () => {
  it("derives direction, counterparty, net movement and fee for the payer", () => {
    const r = receiptFor("0.0.111", OUTGOING);
    expect(r.direction).toBe("out");
    expect(r.counterparty).toBe("0.0.222"); // PINS A HEURISTIC (not a fact — largest opposite leg)
    // Facts:
    expect(r.movements).toEqual([{ asset: "HBAR", amount: -100_001_000_000n, kind: "hbar" }]);
    expect(r.feeTinybar).toBe(1_000_000n);
  });

  it("sees the same transaction as an inflow from the receiver's side", () => {
    const r = receiptFor("0.0.222", OUTGOING);
    expect(r.direction).toBe("in");
    expect(r.counterparty).toBe("0.0.111");
    expect(r.feeTinybar).toBe(0n);
  });

  it("reads as plain language — the payer sent, minus the fee", () => {
    const text = toText(receiptFor("0.0.111", OUTGOING));
    expect(text).toContain("You sent 1000.00000000 ℏ to 0.0.222"); // fee excluded from the amount
    expect(text).toContain("Network fee: 0.01000000 ℏ");
    expect(text).toContain("not independently verified");
    expect(text).not.toContain("counterparty"); // no jargon
  });
});

describe("fiat valuation", () => {
  it("values HBAR exactly via a PriceSource", () => {
    const prices: PriceSource = { currency: "USD", source: "test", valueHbar: (t) => (t * 5n) / 100_000_000n };
    const r = receiptFor("0.0.222", OUTGOING, { prices });
    expect(r.fiat?.amount).toBe(5000n); // 1000 ℏ received * 5 cents
  });

  it("values the amount transferred (fee excluded) and states the fee's value separately", () => {
    const prices: PriceSource = { currency: "USD", source: "test", valueHbar: (t) => (t * 5n) / 100_000_000n };
    const r = receiptFor("0.0.111", OUTGOING, { prices }); // the payer
    expect(r.fiat?.amount).toBe(-5000n); // value of the 1000 ℏ sent, NOT 1000.01
    expect(r.feeFiat?.amount).toBe(0n); // the 0.01 ℏ fee is under a cent
    const text = toText(r);
    expect(text).toMatch(/You sent 1000\.00000000 ℏ \(≈ 50\.00 USD\) to 0\.0\.222/);
    expect(text).toContain("Network fee: 0.01000000 ℏ (< 0.01 USD)");
    expect(text).not.toContain("Approx. value"); // no ambiguous standalone line
  });

  it("usdPriceFromExchangeRate uses Hedera's on-chain rate, exactly", () => {
    // 154000 cents == 30000 ℏ  →  ~5.13 ¢/ℏ
    const prices = usdPriceFromExchangeRate({ hbarEquivalent: 30_000, centEquivalent: 154_000 });
    expect(prices.valueHbar(25_000_000_000n, "1783200000.0")).toBe(1283n); // 250 ℏ ≈ $12.83
    expect(prices.currency).toBe("USD");
  });

  it("picks the rate window that covers the transaction's timestamp", () => {
    const prices = usdPriceFromExchangeRates([
      { hbarEquivalent: 30_000, centEquivalent: 154_000, expirationTime: 2000 }, // valid up to t=2000
      { hbarEquivalent: 30_000, centEquivalent: 300_000, expirationTime: 4000 }, // valid up to t=4000
    ]);
    // A transaction at t=1500 uses the first window (~5.13 ¢/ℏ).
    expect(prices.valueHbar(100_000_000n, "1500.0")).toBe(5n); // 1 ℏ → 5 cents
    // A transaction at t=3000 uses the second (~10 ¢/ℏ).
    expect(prices.valueHbar(100_000_000n, "3000.0")).toBe(10n); // 1 ℏ → 10 cents
    // No window covers a time past the last expiry → not valued.
    expect(prices.valueHbar(100_000_000n, "9999.0")).toBeUndefined();
  });
});

describe("staking rewards", () => {
  const REWARD: NormalizedTransaction = {
    transactionId: "0.0.222@1783123300.0",
    consensusTimestamp: "1783123300.000000000",
    txType: "cryptoTransfer",
    status: "success",
    payer: "0.0.222",
    feeTinybar: 0n,
    hbarTransfers: [
      { account: "0.0.800", amount: -1_250_000_000n }, // reward account
      { account: "0.0.222", amount: 1_250_000_000n }, // the earner
    ],
    tokenTransfers: [],
    stakingRewards: [{ account: "0.0.222", amount: 1_250_000_000n }],
    provenance: { kind: "unverified", source: "mirror" },
  };

  it("labels a staking reward in plain language rather than a generic receipt", () => {
    const r = receiptFor("0.0.222", REWARD);
    expect(r.stakingRewardTinybar).toBe(1_250_000_000n);
    expect(toText(r)).toContain("You earned a staking reward of 12.50000000 ℏ");
  });
});

describe("fromMirror adapter", () => {
  it("maps a mirror transaction into the normalized shape, incl. staking rewards", () => {
    const norm = fromMirror({
      transaction_id: "0.0.5-1783123259-905485000",
      name: "cryptoTransfer",
      result: "SUCCESS",
      consensus_timestamp: "1783123259.905485000",
      charged_tx_fee: 1_000_000,
      transfers: [{ account: "0.0.5", amount: -50 }, { account: "0.0.6", amount: 50 }],
      token_transfers: [],
      staking_reward_transfers: [{ account: "0.0.6", amount: 50 }],
    });
    expect(norm.payer).toBe("0.0.5");
    expect(norm.provenance).toEqual({ kind: "unverified", source: "mirror" });
    expect(norm.stakingRewards?.[0]?.amount).toBe(50n);
  });

  it("serializes bigints as strings in canonical JSON", () => {
    expect(toJSON(receiptFor("0.0.111", OUTGOING))).toContain('"amount": "-100001000000"');
  });
});
