/**
 * Real HBAR→USD `PriceSource`s backed by Hedera's **on-chain exchange rate**
 * — the same rate the network uses to price fees, not a market feed.
 *
 * The rate changes over time, so a receipt must be valued at the rate in
 * effect at the transaction's consensus timestamp. Two ways to get that
 * right, both with the fetch (async I/O) done by the caller:
 *
 * 1. Per-transaction — fetch the rate *as of* the transaction's timestamp:
 *      const { currentRate } = await mirror.queryExchangeRates({ timestamp: tx.consensus_timestamp });
 *      const prices = usdPriceFromExchangeRate(currentRate);
 *
 * 2. Batch — load several rate windows and let the source pick by timestamp:
 *      const prices = usdPriceFromExchangeRates(rates); // rates carry expirationTime
 */
import type { PriceSource } from "../prices.js";
import { TINYBAR_PER_HBAR } from "../money.js";

/**
 * The rate shape from `@hiero-hackers/enterprise-mirror`'s `ExchangeRate`
 * (`centEquivalent` cents == `hbarEquivalent` HBAR, valid until
 * `expirationTime`). Described structurally — no runtime dependency.
 */
export interface ExchangeRateLike {
  readonly hbarEquivalent: number;
  readonly centEquivalent: number;
  /** Seconds since epoch at which this rate expires (mirror `expiration_time`). */
  readonly expirationTime?: string | number;
}

/** Exact cents for `tinybar` at `rate` (single final division — no rounding drift). */
function value(tinybar: bigint, rate: ExchangeRateLike): bigint | undefined {
  const hbar = BigInt(rate.hbarEquivalent);
  if (hbar === 0n) return undefined;
  return (tinybar * BigInt(rate.centEquivalent)) / (hbar * TINYBAR_PER_HBAR);
}

/**
 * A USD `PriceSource` from a single rate. Correct only when that rate is the
 * one in effect at the transaction's time — so fetch it *as of* the
 * transaction's consensus timestamp (`queryExchangeRates({ timestamp })`).
 * Time is not checked here; use {@link usdPriceFromExchangeRates} to have the
 * right window selected for you.
 */
export function usdPriceFromExchangeRate(rate: ExchangeRateLike): PriceSource {
  return {
    currency: "USD",
    source: "hedera-network-exchange-rate",
    valueHbar: (tinybar) => value(tinybar, rate),
  };
}

/**
 * A time-aware USD `PriceSource` over several rate windows. Each Hedera rate
 * is valid until its `expirationTime`; the rate covering timestamp `at` is
 * the one with the smallest expiration still after `at`. Returns `undefined`
 * when `at` is after every loaded window.
 *
 * One honest limit: the wire carries an expiry but no validity *start*, so
 * an `at` **earlier** than the earliest window's real period cannot be
 * detected — it would be valued with that earliest rate. Contiguous windows
 * guard each other (each starts where its predecessor expires); load a set
 * that brackets your transactions, oldest first included.
 */
export function usdPriceFromExchangeRates(rates: readonly ExchangeRateLike[]): PriceSource {
  const windows = rates
    .filter((r) => r.expirationTime !== undefined)
    .map((r) => ({ rate: r, expires: seconds(r.expirationTime as string | number) }))
    .sort((a, b) => a.expires - b.expires);
  return {
    currency: "USD",
    source: "hedera-network-exchange-rate",
    valueHbar(tinybar, at) {
      const atSecs = seconds(at);
      const window = windows.find((w) => w.expires > atSecs);
      return window ? value(tinybar, window.rate) : undefined;
    },
  };
}

const seconds = (v: string | number): number =>
  typeof v === "number" ? v : Number(v.split(".")[0]);
