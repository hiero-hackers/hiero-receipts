/**
 * The JSON schema is the machine contract for `toJSON` output
 * (schema/receipt.v1.schema.json, shipped in the package). These tests pin
 * both directions: every receipt shape the library produces validates, and
 * the schema is strict enough to reject the mistakes it exists to prevent
 * (bigints as JSON numbers, unknown fields).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import { receiptFor, toJSON } from "../src/index.js";
import { fromMirror, type TransactionInfoLike } from "../src/adapters/mirror.js";
import { fromStream } from "../src/adapters/stream.js";
import { usdPriceFromExchangeRate } from "../src/adapters/exchange-rate.js";

const schema = JSON.parse(
  readFileSync(new URL("../schema/receipt.v1.schema.json", import.meta.url), "utf8"),
) as object;
const validate = new Ajv2020({ allErrors: true }).compile(schema);

const expectValid = (receiptJson: string): void => {
  const ok = validate(JSON.parse(receiptJson));
  expect(validate.errors ?? []).toEqual([]);
  expect(ok).toBe(true);
};

const MIRROR_TX: TransactionInfoLike = {
  transactionId: "0.0.7001-1721300000-000000001",
  name: "CRYPTOTRANSFER",
  result: "SUCCESS",
  consensusTimestamp: "1721300000.000000001",
  chargedTxFee: "5000000",
  memo: "invoice 42",
  transfers: [
    { accountId: "0.0.7001", amount: "-25005000000" },
    { accountId: "0.0.8891", amount: "25000000000" },
    { accountId: "0.0.98", amount: "5000000" },
  ],
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
  stakingRewardTransfers: [{ accountId: "0.0.7001", amount: "1200" }],
};

describe("receipt JSON validates against schema/receipt.v1.schema.json", () => {
  it("a rich mirror receipt (fiat, memo, NFTs, staking reward)", () => {
    const receipt = receiptFor("0.0.7001", fromMirror(MIRROR_TX, { network: "mainnet" }), {
      prices: usdPriceFromExchangeRate({ hbarEquivalent: 30000, centEquivalent: 174000 }),
    });
    expectValid(toJSON(receipt));
  });

  it("a verified stream receipt (block, scheme, signers)", () => {
    const receipt = receiptFor(
      "11.12.98",
      fromStream(
        {
          consensusTimestamp: "1774994578.577840000",
          payer: "11.12.2",
          type: "cryptoTransfer",
          result: "SUCCESS",
          chargedFeeTinybar: "158",
          transfers: [
            { account: "11.12.2", amount: "-159" },
            { account: "11.12.98", amount: "1" },
            { account: "11.12.4", amount: "158" },
          ],
          tokenTransfers: [],
        },
        {
          blockNumber: 467,
          proofPath: "wraps-compressed-proof",
          valid: true,
          schnorr: { signerCount: 2, totalNodes: 3 },
        },
        { network: "previewnet" },
      ),
    );
    expectValid(toJSON(receipt));
  });

  it("a minimal fee-only receipt (no optionals at all)", () => {
    const receipt = receiptFor(
      "0.0.5555",
      fromMirror({
        transactionId: "0.0.7001-1-2",
        name: "CONTRACTCALL",
        result: "FAIL_INVALID",
        consensusTimestamp: "1721300000.000000001",
        chargedTxFee: 0,
        transfers: [],
        tokenTransfers: [],
      }),
    );
    expectValid(toJSON(receipt));
  });
});

describe("the schema rejects what it exists to prevent", () => {
  const base = () =>
    JSON.parse(
      toJSON(receiptFor("0.0.7001", fromMirror(MIRROR_TX, { network: "mainnet" }))),
    ) as Record<string, unknown>;

  it("a bigint leaked as a JSON number", () => {
    const bad = base();
    bad.feeTinybar = 5000000;
    expect(validate(bad)).toBe(false);
  });

  it("an unknown extra field", () => {
    const bad = base();
    bad.surprise = "field";
    expect(validate(bad)).toBe(false);
  });

  it("a provenance claiming verified without a block", () => {
    const bad = base();
    bad.provenance = { kind: "verified", source: "stream", scheme: "WRAPS" };
    expect(validate(bad)).toBe(false);
  });
});
