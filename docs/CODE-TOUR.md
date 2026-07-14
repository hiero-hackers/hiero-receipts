# Code tour

A reading order — each file only needs concepts from the ones before it.

## Start: the value type

1. **`src/money.ts`** — `bigint` amounts in smallest units, `toBigInt` (the
   `number`→`bigint` boundary, and why `number` is unsafe), and exact
   `render`. The whole precision discipline, in one small file.

## The shapes

2. **`src/normalized.ts`** — `NormalizedTransaction`, the single source-
   agnostic input, and `Provenance` (`unverified` vs `verified`). Note the
   required-vs-optional split.
3. **`src/receipt.ts`** — the `Receipt` output model (`Movement`,
   `NftMovement`, `FiatValue`, `Direction`).
4. **`src/prices.ts`** — the `PriceSource` interface (pluggable, approximate
   fiat).

## The core logic

5. **`src/generate.ts`** — `receiptFor(account, tx)`. This is the reusable
   heart: net movement per asset for the account, direction, the
   counterparty heuristic, fee attribution (only the payer bears it), and
   optional fiat. Pure, no I/O.

## Presentation

6. **`src/summary.ts`** — the plain-language layer: turns a `Receipt` into
   human sentences ("You sent 250 ℏ to …") and a readable date, in one place
   so text and HTML agree. This is where the wording lives.
7. **`src/render/json.ts`** — canonical JSON (bigints → strings).
8. **`src/render/text.ts`** / **`html.ts`** — plain-text and styled receipts,
   both driven by `summarize`.

## The sources and fiat

9. **`src/adapters/mirror.ts`** — `fromMirror`: the primary, rich, unverified
   source (`@hiero-enterprise/mirror`).
10. **`src/adapters/stream.ts`** — `fromStream`: the verified, leaner source
    (`@hiero-streams/node`).
11. **`src/adapters/exchange-rate.ts`** — `usdPriceFromExchangeRate`: a real
    `PriceSource` from Hedera's on-chain exchange rate.

## Public surface & tests

- **`src/index.ts`** — the core exports. Adapters are reached via subpaths
  (`hiero-receipts/mirror`, `hiero-receipts/stream`) so the core stays
  source-dependency-free.
- **`test/generate.test.ts`** — `receiptFor` from both the sender's and
  receiver's viewpoint, fee attribution, fiat, and the mirror adapter.

## One-paragraph mental model

The caller fetches a transaction (mirror or stream) and maps it through an
adapter into a `NormalizedTransaction`; `receiptFor` turns that into a
`Receipt` for one account; a renderer emits JSON/text/HTML. The source sets
the `provenance`. See [ARCHITECTURE.md](ARCHITECTURE.md) for the why.
