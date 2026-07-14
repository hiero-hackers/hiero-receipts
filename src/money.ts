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
