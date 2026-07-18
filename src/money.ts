/**
 * Exact integer money. Every amount is a `bigint` in the asset's smallest
 * unit — tinybar for HBAR, base units for a token. `number` is never used
 * for a value: JavaScript's `number` is an IEEE-754 double (safe only to
 * 2^53), and a single large token amount can exceed that. No float ever
 * touches a balance; decimals affect *display* only.
 */

export const TINYBAR_PER_HBAR = 100_000_000n;
export const HBAR_DECIMALS = 8;

/**
 * Widen a value into a `bigint`, safely. A `number` is truncated to an
 * integer — but note that a `number` which already exceeded 2^53 lost
 * precision before it reached us (e.g. a huge amount typed as `number` by a
 * mirror-node client), and that loss is unrecoverable. Prefer string inputs.
 */
export function toBigInt(value: bigint | number | string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "string") return BigInt(value.trim());
  if (!Number.isFinite(value)) throw new Error(`not a finite amount: ${value}`);
  return BigInt(Math.trunc(value));
}

/**
 * Format `amount` (smallest units) at `decimals` places, exactly, by integer
 * split — never division into a float. `suffix` is appended as-is.
 */
export function render(amount: bigint, decimals: number, suffix = ""): string {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new RangeError(`decimals must be a non-negative integer, got ${decimals}`);
  }
  if (decimals === 0) return `${amount}${suffix}`;
  const scale = 10n ** BigInt(decimals);
  const sign = amount < 0n ? "-" : "";
  const abs = amount < 0n ? -amount : amount;
  const whole = abs / scale;
  const frac = (abs % scale).toString().padStart(decimals, "0");
  return `${sign}${whole}.${frac}${suffix}`;
}

/** Render an HBAR amount (tinybar) as `ℏ`. */
export function renderHbar(tinybar: bigint): string {
  return render(tinybar, HBAR_DECIMALS, " ℏ");
}

// One Intl lookup per locale, ever — the separator can't change at runtime.
const DECIMAL_SEPARATORS = new Map<string, string>();
function decimalSeparator(locale: string): string {
  let sep = DECIMAL_SEPARATORS.get(locale);
  if (!sep) {
    sep =
      new Intl.NumberFormat(locale).formatToParts(1.1).find((p) => p.type === "decimal")?.value ??
      ".";
    DECIMAL_SEPARATORS.set(locale, sep);
  }
  return sep;
}

/**
 * {@link render} with the locale's decimal separator (`250,00000000` for
 * `de-DE`). Digits stay ASCII, ungrouped, and exact — only the separator
 * localizes, so the amount remains unambiguous and machine-parseable. For
 * any locale whose separator is `.` this is byte-identical to `render`.
 */
export function renderLocalized(
  amount: bigint,
  decimals: number,
  locale: string,
  suffix = "",
): string {
  const plain = render(amount, decimals, suffix);
  if (decimals === 0) return plain;
  const sep = decimalSeparator(locale);
  return sep === "." ? plain : plain.replace(".", sep);
}
