import type { NormalizedTransaction } from "./normalized.js";
import type { Direction, FiatValue, Movement, NftMovement, Receipt } from "./receipt.js";
import type { PriceSource } from "./prices.js";

export interface ReceiptOptions {
  /** Optional fiat valuation of the net HBAR movement. */
  readonly prices?: PriceSource;
}

/**
 * Build a receipt for `account` from one normalized transaction. Pure — no
 * I/O. The caller has already fetched the transaction (and any price data)
 * from whichever source it chose.
 */
export function receiptFor(
  account: string,
  tx: NormalizedTransaction,
  opts: ReceiptOptions = {},
): Receipt {
  // Net HBAR movement for this account.
  let hbarNet = 0n;
  for (const leg of tx.hbarTransfers) {
    if (leg.account === account) hbarNet += leg.amount;
  }

  // Net movement per token for this account.
  const tokenNet = new Map<string, bigint>();
  for (const leg of tx.tokenTransfers) {
    if (leg.account === account) {
      tokenNet.set(leg.tokenId, (tokenNet.get(leg.tokenId) ?? 0n) + leg.amount);
    }
  }

  const movements: Movement[] = [];
  if (hbarNet !== 0n) movements.push({ asset: "HBAR", amount: hbarNet, kind: "hbar" });
  for (const [tokenId, amount] of tokenNet) {
    if (amount !== 0n) movements.push({ asset: tokenId, amount, kind: "token" });
  }

  const nft: NftMovement[] = [];
  for (const leg of tx.nftTransfers ?? []) {
    if (leg.sender === account) nft.push({ tokenId: leg.tokenId, serial: leg.serial, direction: "out" });
    else if (leg.receiver === account) nft.push({ tokenId: leg.tokenId, serial: leg.serial, direction: "in" });
  }

  // Staking reward the account received (a subset of its HBAR movement).
  let stakingReward = 0n;
  for (const leg of tx.stakingRewards ?? []) {
    if (leg.account === account) stakingReward += leg.amount;
  }

  const direction = deriveDirection(movements, nft);
  const counterparty = deriveCounterparty(account, tx, hbarNet);
  const feeTinybar = tx.payer === account ? tx.feeTinybar : 0n;

  // Value the HBAR that actually moved, excluding the fee (which is a separate
  // cost, valued on its own). For the payer, `hbarNet` includes the fee, so
  // adding it back gives the amount transferred; for others it is a no-op.
  const transferred = hbarNet + feeTinybar;
  const fiat = fiatFor(transferred, tx.consensusTimestamp, opts.prices);
  const feeFiat = feeTinybar > 0n ? fiatFor(feeTinybar, tx.consensusTimestamp, opts.prices) : undefined;

  return {
    account,
    transactionId: tx.transactionId,
    consensusTimestamp: tx.consensusTimestamp,
    txType: tx.txType,
    status: tx.status,
    direction,
    movements,
    feeTinybar,
    provenance: tx.provenance,
    ...(counterparty !== undefined ? { counterparty } : {}),
    ...(nft.length > 0 ? { nft } : {}),
    ...(stakingReward > 0n ? { stakingRewardTinybar: stakingReward } : {}),
    ...(tx.memo !== undefined && tx.memo !== "" ? { memo: tx.memo } : {}),
    ...(fiat !== undefined ? { fiat } : {}),
    ...(feeFiat !== undefined ? { feeFiat } : {}),
  };
}

function deriveDirection(movements: readonly Movement[], nft: readonly NftMovement[]): Direction {
  const hasIn = movements.some((m) => m.amount > 0n) || nft.some((n) => n.direction === "in");
  const hasOut = movements.some((m) => m.amount < 0n) || nft.some((n) => n.direction === "out");
  if (hasIn && hasOut) return "internal";
  if (hasIn) return "in";
  if (hasOut) return "out";
  return "none";
}

/**
 * The most likely counterparty (documented heuristic): if the account sent
 * HBAR, the largest positive leg among the *other* accounts; if it received,
 * the largest negative (most-outgoing) leg. `undefined` when there is no
 * other party (e.g. a fee-only transaction).
 */
function deriveCounterparty(
  account: string,
  tx: NormalizedTransaction,
  hbarNet: bigint,
): string | undefined {
  const others = tx.hbarTransfers.filter((leg) => leg.account !== account);
  if (others.length === 0) return undefined;
  const pick = others.reduce((best, leg) =>
    hbarNet < 0n ? (leg.amount > best.amount ? leg : best) : (leg.amount < best.amount ? leg : best),
  );
  return pick.account;
}

/** Build the `FiatValue` for a tinybar amount via the price source, if given. */
function fiatFor(tinybar: bigint, at: string, prices: PriceSource | undefined): FiatValue | undefined {
  if (!prices) return undefined;
  const amount = prices.valueHbar(tinybar, at); // `at` = the tx's consensus timestamp
  if (amount === undefined) return undefined;
  return { currency: prices.currency, amount, source: prices.source, at };
}
