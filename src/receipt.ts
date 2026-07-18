import type { Provenance } from "./normalized.js";

/** Net movement of one asset for the receipt's account (signed, smallest unit). */
export interface Movement {
  readonly asset: string; // "HBAR" or a token id
  readonly amount: bigint;
  readonly kind: "hbar" | "token";
}

/** One NFT the account sent or received. */
export interface NftMovement {
  readonly tokenId: string;
  readonly serial: bigint;
  readonly direction: "in" | "out";
}

/** An approximate fiat valuation of the account's net HBAR movement. */
export interface FiatValue {
  readonly currency: string;
  readonly amount: bigint; // fiat minor units (e.g. cents), signed
  readonly source: string; // where the rate came from
  readonly at: string; // the transaction's consensus timestamp
}

export type Direction = "in" | "out" | "internal" | "none";

/**
 * A receipt: one transaction seen from one account's point of view, enriched
 * for a human — direction, counterparty, net movements, fee, memo, an
 * optional fiat value, and a provenance stamp saying whether it is
 * cryptographically verified or merely mirror-sourced.
 */
export interface Receipt {
  readonly account: string;
  /** The account that paid for (initiated) the transaction. */
  readonly payer: string;
  readonly transactionId: string;
  readonly consensusTimestamp: string;
  readonly txType: string;
  readonly status: "success" | "failed";
  readonly direction: Direction;
  readonly counterparty?: string;
  readonly movements: readonly Movement[];
  readonly nft?: readonly NftMovement[];
  /** The staking-reward portion of the HBAR movement (part of `movements`). */
  readonly stakingRewardTinybar?: bigint;
  readonly feeTinybar: bigint; // borne only if the account was the payer
  readonly memo?: string;
  /**
   * Fiat value of the HBAR **transferred** — the amount sent, received, or
   * earned as a reward — **excluding** the network fee. Approximate.
   */
  readonly fiat?: FiatValue;
  /** Fiat value of the network fee alone (payer only). Approximate. */
  readonly feeFiat?: FiatValue;
  readonly provenance: Provenance;
}
