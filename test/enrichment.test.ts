/**
 * The receipt-enrichment features: counterparty for token/NFT-only
 * transfers, type-aware headlines for no-movement transactions, and token
 * symbols.
 */
import { describe, expect, it } from "vitest";
import { receiptFor, toText, summarize } from "../src/index.js";
import { fromMirror, type TransactionInfoLike } from "../src/adapters/mirror.js";

const tx = (over: Partial<TransactionInfoLike>): TransactionInfoLike => ({
  transactionId: "0.0.7001-1721300000-000000001",
  name: "CRYPTOTRANSFER",
  result: "SUCCESS",
  consensusTimestamp: "1721300000.000000001",
  chargedTxFee: 0,
  transfers: [],
  tokenTransfers: [],
  ...over,
});

describe("counterparty for token-only and NFT-only transfers", () => {
  it("token-only: the largest opposite-direction leg", () => {
    const receipt = receiptFor(
      "0.0.7001",
      fromMirror(
        tx({
          tokenTransfers: [
            { tokenId: "0.0.4444", accountId: "0.0.7001", amount: "-50000" },
            { tokenId: "0.0.4444", accountId: "0.0.2222", amount: "10000" },
            { tokenId: "0.0.4444", accountId: "0.0.8891", amount: "40000" },
          ],
        }),
      ),
    );
    expect(receipt.counterparty).toBe("0.0.8891");
    expect(
      toText(receipt, {
        decimals: new Map([["0.0.4444", 2]]),
        symbols: new Map([["0.0.4444", "USDC"]]),
      }),
    ).toContain("You sent 500.00 USDC (0.0.4444) to 0.0.8891");
  });

  it("the receive side words both token and NFT lines", () => {
    const receipt = receiptFor(
      "0.0.8891",
      fromMirror(
        tx({
          tokenTransfers: [
            { tokenId: "0.0.4444", accountId: "0.0.7001", amount: "-50000" },
            { tokenId: "0.0.4444", accountId: "0.0.8891", amount: "50000" },
          ],
          nftTransfers: [
            {
              tokenId: "0.0.9999",
              serialNumber: 7,
              senderAccountId: "0.0.7001",
              receiverAccountId: "0.0.8891",
            },
          ],
        }),
      ),
    );
    const text = toText(receipt, { decimals: new Map([["0.0.4444", 2]]) });
    expect(text).toContain("You received 500.00 0.0.4444 from 0.0.7001");
    expect(text).toContain("You received an NFT (0.0.9999 #7) from 0.0.7001");
  });

  it("NFT-only: the other party on the NFT", () => {
    const receipt = receiptFor(
      "0.0.7001",
      fromMirror(
        tx({
          nftTransfers: [
            {
              tokenId: "0.0.9999",
              serialNumber: 7,
              senderAccountId: "0.0.7001",
              receiverAccountId: "0.0.8891",
            },
          ],
        }),
      ),
    );
    expect(receipt.counterparty).toBe("0.0.8891");
    expect(toText(receipt, { symbols: new Map([["0.0.9999", "KOALA"]]) })).toContain(
      "You sent an NFT (KOALA 0.0.9999 #7) to 0.0.8891",
    );
  });

  it("a symbol never hides the id, and control characters collapse", () => {
    const receipt = receiptFor(
      "0.0.7001",
      fromMirror(
        tx({
          tokenTransfers: [
            { tokenId: "0.0.4444", accountId: "0.0.7001", amount: "-5" },
            { tokenId: "0.0.4444", accountId: "0.0.8891", amount: "5" },
          ],
        }),
      ),
    );
    const line = summarize(receipt, { symbols: new Map([["0.0.4444", "US\nDC"]]) }).events[0]!;
    expect(line).toContain("US DC (0.0.4444)");
    expect(line).not.toContain("\n");
  });
});

describe("type-aware headlines when nothing moved", () => {
  const feeOnly = (name: string): TransactionInfoLike =>
    tx({
      name,
      chargedTxFee: "5000000",
      transfers: [
        { accountId: "0.0.7001", amount: "-5000000" },
        { accountId: "0.0.98", amount: "5000000" },
      ],
    });

  it("the payer of a contract call reads what they did", () => {
    const receipt = receiptFor("0.0.7001", fromMirror(feeOnly("CONTRACTCALL")));
    expect(summarize(receipt).events[0]).toBe("You called a smart contract");
  });

  it("stream-style camelCase types normalize to the same headline", () => {
    const receipt = receiptFor("0.0.7001", fromMirror(feeOnly("cryptoApproveAllowance")));
    expect(summarize(receipt).events[0]).toBe("You granted a spending allowance");
  });

  it("an unknown type keeps the neutral wording", () => {
    const receipt = receiptFor("0.0.7001", fromMirror(feeOnly("SOMEFUTURETYPE")));
    expect(summarize(receipt).events[0]).toBe("No change to your balance");
  });

  it("a bystander is never told they did something", () => {
    const receipt = receiptFor("0.0.5555", fromMirror(feeOnly("CONTRACTCALL")));
    expect(summarize(receipt).events[0]).toBe("No change to your balance");
  });
});
