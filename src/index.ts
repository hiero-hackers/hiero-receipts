/**
 * hiero-receipts — the source-agnostic core.
 *
 * `receiptFor(account, tx) → Receipt`, then render. The two data-source
 * adapters live behind subpath imports so this core depends on neither
 * source package:
 *
 *   import { fromMirror } from "hiero-receipts/mirror";   // convenient, unverified
 *   import { fromStream } from "hiero-receipts/stream";   // verified (secondary)
 */
export { receiptFor } from "./generate.js";
export type { ReceiptOptions } from "./generate.js";
export { toJSON } from "./render/json.js";
export { toText } from "./render/text.js";
export { toHTML } from "./render/html.js";
export { summarize, formatTimestamp } from "./summary.js";
export type { ReceiptSummary, SummaryOptions } from "./summary.js";
export { render, renderHbar, toBigInt, TINYBAR_PER_HBAR, HBAR_DECIMALS } from "./money.js";

export type { PriceSource } from "./prices.js";
export type {
  NormalizedTransaction,
  Provenance,
  HbarLeg,
  TokenLeg,
  NftLeg,
} from "./normalized.js";
export type { Receipt, Movement, NftMovement, FiatValue, Direction } from "./receipt.js";
