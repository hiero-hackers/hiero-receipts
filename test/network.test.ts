import { describe, it, expect } from "vitest";
import { receiptFor } from "../src/index.js";
import { fromMirror, type TransactionInfoLike } from "../src/adapters/mirror.js";
import {
  fromStream,
  type ParsedTransactionLike,
  type BlockProofLike,
} from "../src/adapters/stream.js";

const mirrorTx: TransactionInfoLike = {
  transactionId: "0.0.111-1783012345-000000000",
  name: "CRYPTOTRANSFER",
  result: "SUCCESS",
  consensusTimestamp: "1783012345.000000000",
  chargedTxFee: 100_000,
  transfers: [{ accountId: "0.0.222", amount: 10_000_000_000 }],
  tokenTransfers: [],
};

const streamTx: ParsedTransactionLike = {
  consensusTimestamp: "1783012345.000000000",
  payer: "0.0.111",
  type: "cryptoTransfer",
  result: "SUCCESS",
  chargedFeeTinybar: 100_000,
  transfers: [{ account: "0.0.222", amount: 10_000_000_000 }],
  tokenTransfers: [],
};

/**
 * An account id does not imply a network: 0.0.1234 exists on mainnet AND
 * testnet AND previewnet, owned by different people. Without the network on the
 * receipt, a consumer must be told out-of-band — and being told wrong fails
 * silently, which is the worst way to fail with money.
 */
describe("provenance carries the network", () => {
  it("records the network the caller passed (mirror)", () => {
    const receipt = receiptFor("0.0.222", fromMirror(mirrorTx, { network: "testnet" }));
    expect(receipt.provenance).toMatchObject({
      kind: "unverified",
      source: "mirror",
      network: "testnet",
    });
  });

  it("records the network the caller passed (stream, unverified)", () => {
    const receipt = receiptFor("0.0.222", fromStream(streamTx, undefined, { network: "testnet" }));
    expect(receipt.provenance).toMatchObject({
      kind: "unverified",
      source: "stream",
      network: "testnet",
    });
  });

  it("records the network alongside a verified proof, without disturbing it", () => {
    const proof: BlockProofLike = {
      blockNumber: 467,
      proofPath: "wraps-compressed-proof",
      valid: true,
    };
    const receipt = receiptFor("0.0.222", fromStream(streamTx, proof, { network: "mainnet" }));
    expect(receipt.provenance).toMatchObject({
      kind: "verified",
      source: "stream",
      network: "mainnet",
      block: 467,
    });
  });

  it("distinguishes the SAME account id on two networks — the whole point", () => {
    const main = receiptFor("0.0.222", fromMirror(mirrorTx, { network: "mainnet" }));
    const test = receiptFor("0.0.222", fromMirror(mirrorTx, { network: "testnet" }));
    expect(main.account).toBe(test.account); // identical id…
    expect(main.provenance).not.toEqual(test.provenance); // …different provenance
  });
});

describe("network is optional — omitting it stays backwards compatible", () => {
  it("omits the key entirely rather than writing undefined", () => {
    const receipt = receiptFor("0.0.222", fromMirror(mirrorTx));
    expect(receipt.provenance).toEqual({ kind: "unverified", source: "mirror" });
    expect("network" in receipt.provenance).toBe(false);
  });

  it("still omits it on the verified path", () => {
    const proof: BlockProofLike = {
      blockNumber: 467,
      proofPath: "wraps-compressed-proof",
      valid: true,
    };
    expect("network" in receiptFor("0.0.222", fromStream(streamTx, proof)).provenance).toBe(false);
  });
});
