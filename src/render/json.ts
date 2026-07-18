import type { Receipt } from "../receipt.js";

/**
 * Canonical JSON. `bigint`s are serialized as decimal *strings* (exact — a
 * JSON number would risk the very precision loss this library avoids).
 */
export function toJSON(receipt: Receipt, space = 2): string {
  return JSON.stringify(
    receipt,
    (_key, value) => (typeof value === "bigint" ? value.toString() : value),
    space,
  );
}
