/**
 * Thin mirror-node REST access — the fetch half of the mirror adapter.
 *
 * `fromMirror` (./mirror.js) maps an already-fetched transaction; this module
 * does the fetching, for consumers that want a page-sized dependency instead
 * of a data client. It exists because two consumers (hiero-checkout,
 * hiero-x402) had independently grown the same ~140 lines: the snake_case →
 * `TransactionInfoLike` mapping, base64 memo decoding, and the REST spelling
 * of a transaction id. Third copy wanted = library code.
 *
 * Deliberately NOT a client: three endpoints, an injectable `fetch`, no
 * retries, no backoff, no paging — that is `enterprise-mirror`'s job. Hosts
 * are the caller's config (which networks you serve is app policy), so every
 * function takes the mirror host, e.g. `https://testnet.mirrornode.hedera.com`.
 * Browser-clean: standard `fetch`/`atob`/`TextDecoder` only.
 */
import type { TransactionInfoLike } from "./mirror.js";

/** The raw REST transaction row (snake_case) — only the fields we map. */
export interface RestTransaction {
  transaction_id: string;
  name: string;
  result: string;
  consensus_timestamp: string;
  charged_tx_fee: number;
  memo_base64?: string | null;
  transfers?: { account: string; amount: number }[];
  token_transfers?: { token_id: string; account: string; amount: number }[];
  nft_transfers?: {
    token_id: string;
    serial_number: number;
    sender_account_id: string | null;
    receiver_account_id: string;
  }[];
  staking_reward_transfers?: { account: string; amount: number }[];
}

/**
 * A Hedera transaction id in the mirror REST path form `0.0.x-seconds-nanos`
 * (nanos zero-padded). Accepts the SDK/HashScan form `0.0.x@seconds.nanos`
 * and the REST form itself; anything else is a loud error — a typo must not
 * silently look up nothing.
 */
export function restTransactionId(transactionId: string): string {
  const parts =
    /^(\d+\.\d+\.\d+)@(\d+)\.(\d+)$/.exec(transactionId) ??
    /^(\d+\.\d+\.\d+)-(\d+)-(\d+)$/.exec(transactionId);
  if (parts === null) {
    throw new Error(
      `not a Hedera transaction id: "${transactionId}" ` +
        '(expected "0.0.x@seconds.nanos" or "0.0.x-seconds-nanos")',
    );
  }
  return `${parts[1]}-${parts[2]}-${parts[3]!.padStart(9, "0")}`;
}

/** REST snake_case row → the camelCase shape `fromMirror` accepts, memo decoded. */
export function toTransactionInfo(tx: RestTransaction): TransactionInfoLike {
  const memo = decodeMemo(tx.memo_base64);
  return {
    transactionId: tx.transaction_id,
    name: tx.name,
    result: tx.result,
    consensusTimestamp: tx.consensus_timestamp,
    chargedTxFee: tx.charged_tx_fee,
    ...(memo !== undefined ? { memo } : {}),
    transfers: (tx.transfers ?? []).map((t) => ({ accountId: t.account, amount: t.amount })),
    tokenTransfers: (tx.token_transfers ?? []).map((t) => ({
      tokenId: t.token_id,
      accountId: t.account,
      amount: t.amount,
    })),
    nftTransfers: (tx.nft_transfers ?? []).map((n) => ({
      tokenId: n.token_id,
      serialNumber: n.serial_number,
      senderAccountId: n.sender_account_id ?? "",
      receiverAccountId: n.receiver_account_id,
    })),
    stakingRewardTransfers: (tx.staking_reward_transfers ?? []).map((s) => ({
      accountId: s.account,
      amount: s.amount,
    })),
  };
}

function decodeMemo(base64: string | null | undefined): string | undefined {
  if (base64 == null || base64 === "") return undefined;
  try {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return undefined; // an undecodable memo is a memo we don't have
  }
}

/** Injectable transport — defaults to the global `fetch` everywhere below. */
export interface FetchOptions {
  readonly fetchImpl?: typeof fetch;
}

async function getJson(
  url: string,
  fetchImpl: typeof fetch,
): Promise<{ status: number; body: unknown }> {
  const response = await fetchImpl(url, { headers: { accept: "application/json" } });
  if (response.status === 404) return { status: 404, body: undefined };
  if (!response.ok) throw new Error(`mirror node answered ${response.status} for ${url}`);
  return { status: response.status, body: await response.json() };
}

/**
 * Every row for one transaction id — usually one, but duplicates and child
 * transactions share the id, and a verdict should see them all. `[]` on 404:
 * not-yet-ingested is an input to the caller's logic, not an error.
 */
export async function transactionsById(
  host: string,
  transactionId: string,
  opts: FetchOptions = {},
): Promise<TransactionInfoLike[]> {
  const url = `${host}/api/v1/transactions/${restTransactionId(transactionId)}`;
  const { body } = await getJson(url, opts.fetchImpl ?? fetch);
  const rows = (body as { transactions?: RestTransaction[] } | undefined)?.transactions ?? [];
  return rows.map(toTransactionInfo);
}

/** Recent transactions touching `accountId`, newest first, mapped and ready
 *  for `fromMirror`. */
export async function recentTransactions(
  host: string,
  accountId: string,
  opts: FetchOptions & { readonly limit?: number } = {},
): Promise<TransactionInfoLike[]> {
  const url =
    `${host}/api/v1/transactions?account.id=${encodeURIComponent(accountId)}` +
    `&order=desc&limit=${opts.limit ?? 25}`;
  const { body } = await getJson(url, opts.fetchImpl ?? fetch);
  const rows = (body as { transactions?: RestTransaction[] } | undefined)?.transactions ?? [];
  return rows.map(toTransactionInfo);
}

/** A token's display decimals, or `undefined` when the lookup fails — show
 *  base units rather than guess. */
export async function tokenDecimals(
  host: string,
  tokenId: string,
  opts: FetchOptions = {},
): Promise<number | undefined> {
  try {
    const { status, body } = await getJson(
      `${host}/api/v1/tokens/${encodeURIComponent(tokenId)}`,
      opts.fetchImpl ?? fetch,
    );
    if (status === 404 || body === undefined) return undefined;
    const parsed = Number((body as { decimals?: string | number }).decimals);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}
