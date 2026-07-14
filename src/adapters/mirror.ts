/**
 * Mirror adapter — the primary source. Maps a mirror-node transaction (as
 * returned by `@hiero-enterprise/mirror`'s `MirrorNodeClient`) into a
 * `NormalizedTransaction`. Rich source: HBAR, tokens, NFTs, memo — but
 * `unverified` provenance (operator-attested, not cryptographically proven).
 *
 * The input is described structurally so this adapter needs no runtime
 * dependency on the mirror package — a real `MirrorTransaction` satisfies it.
 */
import type { NftLeg, NormalizedTransaction, TokenLeg } from "../normalized.js";
import { toBigInt } from "../money.js";
import { hbarLegs, statusOf } from "./shared.js";

/** The subset of `@hiero-enterprise/mirror`'s `MirrorTransaction` we read. */
export interface MirrorTransactionLike {
  transaction_id: string;
  name: string;
  result: string;
  consensus_timestamp: string;
  charged_tx_fee: number | string;
  memo_base64?: string | null;
  transfers: { account: string; amount: number | string }[];
  token_transfers: { token_id: string; account: string; amount: number | string }[];
  nft_transfers?: { token_id: string; serial_number: number | string; sender_account_id: string; receiver_account_id: string }[];
  staking_reward_transfers?: { account: string; amount: number | string }[];
}

export function fromMirror(tx: MirrorTransactionLike): NormalizedTransaction {
  const tokenTransfers: TokenLeg[] = tx.token_transfers.map((t) => ({
    tokenId: t.token_id,
    account: t.account,
    amount: toBigInt(t.amount),
  }));
  const nftTransfers: NftLeg[] = (tx.nft_transfers ?? []).map((n) => ({
    tokenId: n.token_id,
    serial: toBigInt(n.serial_number),
    sender: n.sender_account_id,
    receiver: n.receiver_account_id,
  }));
  const stakingRewards = hbarLegs(tx.staking_reward_transfers ?? []);

  // The payer is the account in the transaction id (`0.0.x-secs-nanos`).
  const payer = tx.transaction_id.split("-")[0] ?? "";
  const memo = tx.memo_base64 ? Buffer.from(tx.memo_base64, "base64").toString("utf8") : undefined;

  return {
    transactionId: tx.transaction_id,
    consensusTimestamp: tx.consensus_timestamp,
    txType: tx.name,
    status: statusOf(tx.result),
    payer,
    feeTinybar: toBigInt(tx.charged_tx_fee),
    hbarTransfers: hbarLegs(tx.transfers),
    tokenTransfers,
    provenance: { kind: "unverified", source: "mirror" },
    ...(nftTransfers.length > 0 ? { nftTransfers } : {}),
    ...(stakingRewards.length > 0 ? { stakingRewards } : {}),
    ...(memo ? { memo } : {}),
  };
}
