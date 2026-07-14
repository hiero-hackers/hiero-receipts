/**
 * Fiat valuation — policy over an external rate, kept behind an interface so
 * the receipt core stays pure. A fiat figure on a receipt is *approximate*,
 * never a provable on-ledger fact.
 *
 * `valueHbar` takes the whole tinybar amount (not a per-unit rate) so an
 * implementation can do exact rational math — e.g. Hedera's on-chain rate is
 * a ratio (`centEquivalent` cents per `hbarEquivalent` HBAR), which a single
 * "cents per ℏ" number could not represent without rounding.
 */
export interface PriceSource {
  /** ISO currency code, e.g. "USD". */
  readonly currency: string;
  /** Human note on where the rate came from. */
  readonly source: string;
  /**
   * Value `tinybar` of HBAR in fiat *minor* units (e.g. cents) **as of the
   * consensus timestamp `at`** ("seconds.nanos"), exactly, or `undefined` if
   * no rate is known for that time. The exchange rate changes over time, so
   * `at` matters: an old transaction must be valued at the rate then in
   * effect, not the current one. Sign follows the input.
   */
  valueHbar(tinybar: bigint, at: string): bigint | undefined;
}
