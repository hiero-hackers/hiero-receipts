/**
 * Stream adapter — the verified source (secondary). Maps a parsed
 * transaction from `@hiero-hackers/streams-node` (`parseBlockJson` /
 * `parseRecordFileJson`, then `JSON.parse`) into a `NormalizedTransaction`,
 * stamped `verified` when accompanied by a valid proof from
 * `verifyBlockProofJson`.
 *
 * Leaner than the mirror source: the canonical parsed shape carries HBAR and
 * fungible token legs, but not NFTs, memo, or staking-reward annotations (see
 * docs/ARCHITECTURE.md — the richness/proof trade-off). What it gives up in
 * detail it gains in proof.
 *
 * Shapes described structurally, so no runtime dependency on the binding.
 */
import type { NormalizedTransaction, Network, Provenance, TokenLeg } from "../normalized.js";
import { toBigInt } from "../money.js";
import { hbarLegs, statusOf } from "./shared.js";

/** A parsed transaction as emitted by `@hiero-hackers/streams-node` (camelCase JSON). */
export interface ParsedTransactionLike {
  consensusTimestamp: string;
  payer: string;
  type: string;
  result: string;
  chargedFeeTinybar: number | string;
  transfers: { account: string; amount: number | string }[];
  tokenTransfers: { token: string; account: string; amount: number | string }[];
}

/** A proof result from `@hiero-hackers/streams-node`'s `verifyBlockProofJson`. */
export interface BlockProofLike {
  blockNumber: number;
  /** "aggregate-schnorr" (genesis / pre-settled) or "wraps-compressed-proof". */
  proofPath: string;
  valid: boolean;
  schnorr?: { signerCount: number; totalNodes: number } | null;
}

/**
 * Build a normalized transaction from a parsed stream transaction. Pass the
 * block's verified `proof` to stamp `verified` provenance; omit it (or pass an
 * invalid proof) and the result is `unverified` — never claim a proof you did
 * not check.
 */
export interface FromStreamOptions {
  /**
   * Which network this block came from — `"mainnet"`, `"testnet"`, …
   *
   * Pass it from wherever you got the stream. A parsed transaction doesn't
   * carry a network and an account id doesn't imply one, so this is the only
   * chance to record it.
   */
  readonly network?: Network;
}

export function fromStream(
  tx: ParsedTransactionLike,
  proof?: BlockProofLike,
  opts: FromStreamOptions = {},
): NormalizedTransaction {
  const network = opts.network !== undefined ? { network: opts.network } : {};
  const tokenTransfers: TokenLeg[] = tx.tokenTransfers.map((t) => ({
    tokenId: t.token,
    account: t.account,
    amount: toBigInt(t.amount),
  }));

  const provenance: Provenance =
    proof && proof.valid
      ? {
          kind: "verified",
          source: "stream",
          ...network,
          block: proof.blockNumber,
          scheme: schemeLabel(proof.proofPath),
          ...(proof.schnorr
            ? { signers: [proof.schnorr.signerCount, proof.schnorr.totalNodes] }
            : {}),
        }
      : { kind: "unverified", source: "stream", ...network };

  return {
    transactionId: `${tx.payer}@${tx.consensusTimestamp}`,
    consensusTimestamp: tx.consensusTimestamp,
    txType: tx.type,
    status: statusOf(tx.result),
    payer: tx.payer,
    feeTinybar: toBigInt(tx.chargedFeeTinybar),
    hbarTransfers: hbarLegs(tx.transfers),
    tokenTransfers,
    provenance,
  };
}

/** The `proofPath` slug → a human-readable scheme name for the receipt. */
function schemeLabel(proofPath: string): string {
  if (proofPath.startsWith("wraps")) return "WRAPS";
  if (proofPath.startsWith("aggregate")) return "aggregate-Schnorr";
  return proofPath;
}
