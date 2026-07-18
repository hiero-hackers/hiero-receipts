/**
 * Mirror adapter — the primary (convenient) source. Maps a mirror-node
 * transaction as returned by `@hiero-hackers/enterprise-mirror`'s `MirrorNodeClient`
 * (a `TransactionInfo`) into a `NormalizedTransaction`. Rich source: HBAR,
 * tokens, NFTs, staking rewards, decoded memo — but `unverified` provenance
 * (operator-attested, not cryptographically proven).
 *
 * The input is described structurally so this adapter needs no runtime
 * dependency on the mirror package — a real `TransactionInfo` satisfies it.
 */
import type { HbarLeg, Network, NftLeg, NormalizedTransaction, TokenLeg } from "../normalized.js";
import { toBigInt } from "../money.js";
import { statusOf } from "./shared.js";

/** The subset of `@hiero-hackers/enterprise-mirror`'s `TransactionInfo` we read. */
export interface TransactionInfoLike {
  transactionId: string;
  name: string;
  result: string;
  consensusTimestamp: string;
  chargedTxFee: number | string;
  memo?: string; // already decoded by the client
  transfers: { accountId: string; amount: number | string }[];
  tokenTransfers: { tokenId: string; accountId: string; amount: number | string }[];
  nftTransfers?: {
    tokenId: string;
    serialNumber: number | string;
    senderAccountId: string;
    receiverAccountId: string;
  }[];
  stakingRewardTransfers?: { accountId: string; amount: number | string }[];
}

export interface FromMirrorOptions {
  /**
   * Which network this transaction came from — `"mainnet"`, `"testnet"`, …
   *
   * Pass it from the same config that constructed your mirror client. A mirror
   * `TransactionInfo` doesn't carry a network and an account id doesn't imply
   * one (`0.0.1234` exists on all of them), so this is the only chance to
   * record it. Omit it and every downstream consumer has to be told separately.
   */
  readonly network?: Network;
}

export function fromMirror(
  tx: TransactionInfoLike,
  opts: FromMirrorOptions = {},
): NormalizedTransaction {
  const hbarTransfers: HbarLeg[] = tx.transfers.map((t) => ({
    account: t.accountId,
    amount: toBigInt(t.amount),
  }));
  const tokenTransfers: TokenLeg[] = tx.tokenTransfers.map((t) => ({
    tokenId: t.tokenId,
    account: t.accountId,
    amount: toBigInt(t.amount),
  }));
  const nftTransfers: NftLeg[] = (tx.nftTransfers ?? []).map((n) => ({
    tokenId: n.tokenId,
    serial: toBigInt(n.serialNumber),
    sender: n.senderAccountId,
    receiver: n.receiverAccountId,
  }));
  const stakingRewards: HbarLeg[] = (tx.stakingRewardTransfers ?? []).map((s) => ({
    account: s.accountId,
    amount: toBigInt(s.amount),
  }));

  // The payer is the account that opens the transaction id ("0.0.x-secs-nanos").
  const payer = tx.transactionId.match(/^\d+\.\d+\.\d+/)?.[0] ?? "";

  return {
    transactionId: tx.transactionId,
    consensusTimestamp: tx.consensusTimestamp,
    txType: tx.name,
    status: statusOf(tx.result),
    payer,
    feeTinybar: toBigInt(tx.chargedTxFee),
    hbarTransfers,
    tokenTransfers,
    provenance: {
      kind: "unverified",
      source: "mirror",
      ...(opts.network !== undefined ? { network: opts.network } : {}),
    },
    ...(nftTransfers.length > 0 ? { nftTransfers } : {}),
    ...(stakingRewards.length > 0 ? { stakingRewards } : {}),
    ...(tx.memo ? { memo: tx.memo } : {}),
  };
}
