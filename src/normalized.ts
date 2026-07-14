/**
 * `NormalizedTransaction` — the single, source-agnostic input the receipt
 * core consumes. Both data sources map *into* this shape via an adapter
 * (`hiero-receipts/mirror`, `hiero-receipts/stream`), so the core never
 * depends on either source package.
 *
 * The common fields are **required**; richer fields a source may or may not
 * provide are **optional**. The mirror source fills them all; the verified
 * stream source fills fewer (see docs/ARCHITECTURE.md — the richness/proof
 * trade-off). A renderer degrades gracefully when an optional is absent.
 */

/** Where the data came from — which sets whether a receipt is provable. */
export type Provenance =
  | { readonly kind: "unverified"; readonly source: "mirror" | "stream" }
  | {
      readonly kind: "verified";
      readonly source: "stream";
      readonly block: number;
      readonly scheme: string;
      readonly signers?: readonly [number, number];
    };

export interface HbarLeg {
  readonly account: string;
  readonly amount: bigint; // signed tinybar
}

export interface TokenLeg {
  readonly tokenId: string;
  readonly account: string;
  readonly amount: bigint; // signed base units
}

export interface NftLeg {
  readonly tokenId: string;
  readonly serial: bigint;
  readonly sender: string;
  readonly receiver: string;
}

export interface NormalizedTransaction {
  readonly transactionId: string;
  readonly consensusTimestamp: string; // "seconds.nanos"
  readonly txType: string; // e.g. "cryptoTransfer"
  readonly status: "success" | "failed";
  readonly payer: string;
  readonly feeTinybar: bigint;
  readonly hbarTransfers: readonly HbarLeg[];
  readonly tokenTransfers: readonly TokenLeg[];
  readonly provenance: Provenance;

  // Optional — richer sources (mirror) provide these; the verified stream
  // source may not (yet).
  readonly nftTransfers?: readonly NftLeg[];
  /** Staking-reward credits (a subset of `hbarTransfers`, annotated). */
  readonly stakingRewards?: readonly HbarLeg[];
  readonly memo?: string;
}
