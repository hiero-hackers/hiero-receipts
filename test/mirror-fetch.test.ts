/**
 * The fetch half of the mirror adapter — offline, on canned REST bodies and a
 * stub `fetch`. What must hold: the id spellings normalize, the snake→camel
 * mapping feeds `fromMirror` cleanly, 404 is data (not an error), and other
 * mirror failures stay loud.
 */
import { describe, expect, it } from "vitest";
import { fromMirror } from "../src/adapters/mirror.js";
import {
  recentTransactions,
  restTransactionId,
  tokenDecimals,
  toTransactionInfo,
  transactionsById,
} from "../src/adapters/mirror-fetch.js";
import type { RestTransaction } from "../src/adapters/mirror-fetch.js";

const HOST = "https://testnet.mirrornode.hedera.com";

const ROW: RestTransaction = {
  transaction_id: "0.0.7000001-1753099999-123456789",
  name: "CRYPTOTRANSFER",
  result: "SUCCESS",
  consensus_timestamp: "1753100000.000000001",
  charged_tx_fee: 76916,
  memo_base64: "aGVsbG8=",
  transfers: [
    { account: "0.0.4507291", amount: -5000000 },
    { account: "0.0.4507290", amount: 5000000 },
  ],
  token_transfers: [{ token_id: "0.0.5449", account: "0.0.1", amount: 5 }],
  nft_transfers: [
    { token_id: "0.0.9", serial_number: 7, sender_account_id: null, receiver_account_id: "0.0.2" },
    {
      token_id: "0.0.9",
      serial_number: 8,
      sender_account_id: "0.0.3",
      receiver_account_id: "0.0.2",
    },
  ],
  staking_reward_transfers: [{ account: "0.0.1", amount: 3 }],
};

function stub(body: unknown, status = 200): { fetchImpl: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  const fetchImpl = ((url: string | URL) => {
    calls.push(String(url));
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("restTransactionId", () => {
  it("accepts both spellings and normalizes nanos", () => {
    expect(restTransactionId("0.0.7@1753099999.123456789")).toBe("0.0.7-1753099999-123456789");
    expect(restTransactionId("0.0.7-1753099999-123456789")).toBe("0.0.7-1753099999-123456789");
    expect(restTransactionId("0.0.7@1.5")).toBe("0.0.7-1-000000005");
  });

  it("refuses anything else, loudly", () => {
    for (const bad of ["", "0.0.7", "0xabc", "0.0.7@1-5", "0.0.7-1.5"]) {
      expect(() => restTransactionId(bad)).toThrow(/transaction id/);
    }
  });
});

describe("toTransactionInfo", () => {
  it("maps a full row into the shape fromMirror accepts — and fromMirror takes it", () => {
    const info = toTransactionInfo(ROW);
    expect(info.memo).toBe("hello");
    expect(info.nftTransfers?.[0]?.senderAccountId).toBe(""); // mint: null → ""
    expect(info.nftTransfers?.[1]?.senderAccountId).toBe("0.0.3");
    const normalized = fromMirror(info, { network: "testnet" });
    expect(normalized.status).toBe("success");
  });

  it("treats an absent or undecodable memo as absent, and missing lists as empty", () => {
    expect(toTransactionInfo({ ...ROW, memo_base64: null }).memo).toBeUndefined();
    expect(toTransactionInfo({ ...ROW, memo_base64: "%%%" }).memo).toBeUndefined();
    const bare = toTransactionInfo({
      transaction_id: ROW.transaction_id,
      name: ROW.name,
      result: ROW.result,
      consensus_timestamp: ROW.consensus_timestamp,
      charged_tx_fee: 1,
    });
    expect(bare.transfers).toEqual([]);
    expect(bare.tokenTransfers).toEqual([]);
  });
});

describe("transactionsById", () => {
  it("hits the by-id endpoint with the REST spelling", async () => {
    const { fetchImpl, calls } = stub({ transactions: [ROW] });
    const rows = await transactionsById(HOST, "0.0.7000001@1753099999.123456789", { fetchImpl });
    expect(rows).toHaveLength(1);
    expect(calls[0]).toBe(`${HOST}/api/v1/transactions/0.0.7000001-1753099999-123456789`);
  });

  it("returns [] on 404 and on a body with no rows", async () => {
    expect(
      await transactionsById(HOST, ROW.transaction_id, { fetchImpl: stub({}, 404).fetchImpl }),
    ).toEqual([]);
    expect(
      await transactionsById(HOST, ROW.transaction_id, { fetchImpl: stub({}).fetchImpl }),
    ).toEqual([]);
  });

  it("stays loud on other mirror failures", async () => {
    const { fetchImpl } = stub({}, 500);
    await expect(transactionsById(HOST, ROW.transaction_id, { fetchImpl })).rejects.toThrow(/500/);
  });
});

describe("recentTransactions", () => {
  it("lists newest-first for the account, mapped", async () => {
    const { fetchImpl, calls } = stub({ transactions: [ROW] });
    const rows = await recentTransactions(HOST, "0.0.4507290", { fetchImpl });
    expect(rows[0]?.transactionId).toBe(ROW.transaction_id);
    expect(calls[0]).toContain("account.id=0.0.4507290");
    expect(calls[0]).toContain("order=desc&limit=25");
  });

  it("honours a custom limit", async () => {
    const { fetchImpl, calls } = stub({ transactions: [] });
    await recentTransactions(HOST, "0.0.4507290", { fetchImpl, limit: 3 });
    expect(calls[0]).toContain("limit=3");
  });
});

describe("tokenDecimals", () => {
  it("parses decimals, tolerating the string the REST API actually sends", async () => {
    expect(
      await tokenDecimals(HOST, "0.0.5449", { fetchImpl: stub({ decimals: "6" }).fetchImpl }),
    ).toBe(6);
    expect(
      await tokenDecimals(HOST, "0.0.5449", { fetchImpl: stub({ decimals: 0 }).fetchImpl }),
    ).toBe(0);
  });

  it("answers undefined on 404, garbage, or transport failure — never guesses", async () => {
    expect(
      await tokenDecimals(HOST, "0.0.5449", { fetchImpl: stub({}, 404).fetchImpl }),
    ).toBeUndefined();
    expect(
      await tokenDecimals(HOST, "0.0.5449", { fetchImpl: stub({ decimals: "x" }).fetchImpl }),
    ).toBeUndefined();
    expect(
      await tokenDecimals(HOST, "0.0.5449", { fetchImpl: stub({}, 500).fetchImpl }),
    ).toBeUndefined();
  });
});
