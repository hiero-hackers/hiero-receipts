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

/**
 * Which Hedera network the data came from — `"mainnet"`, `"testnet"`,
 * `"previewnet"`, `"devnet"`, or a private network's own name.
 *
 * Deliberately a plain string, not a union: this library never talks to a
 * network, so it is in no position to say which names are legitimate.
 */
export type Network = string;

/**
 * Where the data came from — which sets whether a receipt is provable.
 *
 * **`network` matters more than it looks.** An account id does not imply a
 * network: `0.0.1234` exists on mainnet *and* testnet *and* previewnet, and
 * they are different accounts owned by different people. Without this, a
 * consumer has to be told out-of-band which network a receipt describes, and
 * being told wrong fails silently — a testnet receipt is indistinguishable
 * from a mainnet one. It is also what a receipt needs before it can be named
 * by a CAIP-10 identifier (`hedera:mainnet:0.0.1234`), which HIP-30 makes the
 * standard.
 *
 * Optional because no adapter can *derive* it — a mirror `TransactionInfo`
 * doesn't carry one; the caller who constructed the client is the only one who
 * knows. Pass it and it travels with the receipt; omit it and you are back to
 * telling every consumer separately.
 */
export type Provenance =
  | {
      readonly kind: "unverified";
      readonly source: "mirror" | "stream";
      readonly network?: Network;
    }
  | {
      readonly kind: "verified";
      readonly source: "stream";
      readonly network?: Network;
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
