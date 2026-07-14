/**
 * Stream adapter — the verified source (secondary). Maps a parsed
 * transaction from `@hiero-streams/node` (`parseRecordFileJson` /
 * `parseBlockJson`, then `JSON.parse`) into a `NormalizedTransaction`,
 * stamped `verified` when accompanied by a proof result.
 *
 * Leaner than the mirror source: the canonical parsed shape carries HBAR and
 * fungible token legs, but not NFTs or memo (see docs/ARCHITECTURE.md — the
 * richness/proof trade-off). What it gives up in detail it gains in proof.
 */
import type { NormalizedTransaction, Provenance, TokenLeg } from "../normalized.js";
import { toBigInt } from "../money.js";
import { hbarLegs, statusOf } from "./shared.js";

/** The parsed-transaction shape emitted by `@hiero-streams/node` (JSON). */
export interface ParsedTransactionLike {
  consensus_timestamp: string;
  payer: string;
  type: string;
  result: string;
  charged_fee_tinybar: number | string;
  transfers: { account: string; amount: number | string }[];
  token_transfers: { token: string; account: string; amount: number | string }[];
}

/** The proof result shape from `@hiero-streams/node`'s `verifyBlockProofJson`. */
export interface BlockProofLike {
  block_number: number;
  proof_scheme: string;
  valid: boolean;
  signers?: [number, number];
}

/**
 * Build a normalized transaction from a parsed stream transaction. Pass the
 * block's verified `proof` to stamp `verified` provenance; omit it (or pass
 * an invalid proof) and the result is `unverified` — never claim a proof you
 * did not check.
 */
export function fromStream(tx: ParsedTransactionLike, proof?: BlockProofLike): NormalizedTransaction {
  const tokenTransfers: TokenLeg[] = tx.token_transfers.map((t) => ({
    tokenId: t.token,
    account: t.account,
    amount: toBigInt(t.amount),
  }));

  const provenance: Provenance =
    proof && proof.valid
      ? {
          kind: "verified",
          source: "stream",
          block: proof.block_number,
          scheme: proof.proof_scheme,
          ...(proof.signers ? { signers: proof.signers } : {}),
        }
      : { kind: "unverified", source: "stream" }; // no valid proof ⇒ do not claim verification

  return {
    transactionId: `${tx.payer}@${tx.consensus_timestamp}`,
    consensusTimestamp: tx.consensus_timestamp,
    txType: tx.type,
    status: statusOf(tx.result),
    payer: tx.payer,
    feeTinybar: toBigInt(tx.charged_fee_tinybar),
    hbarTransfers: hbarLegs(tx.transfers),
    tokenTransfers,
    provenance,
  };
}
