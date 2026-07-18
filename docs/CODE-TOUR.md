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

6. **`src/messages.ts`** — the `Messages` catalog: every sentence a receipt
   can say, as typed functions (functions, not templates, because languages
   reorder). The built-in English catalog `en` is the default wording.
7. **`src/summary.ts`** — the assembly layer: turns a `Receipt` into
   catalog-worded sentences ("You sent 250 ℏ to …"), detail rows, and the
   memo defenses (sanitize, defang, warn), in one place so text and HTML
   agree.
8. **`src/render/json.ts`** — canonical JSON (bigints → strings), specified
   by `schema/receipt.v1.schema.json`.
9. **`src/render/text.ts`** / **`html.ts`** — plain-text and styled receipts,
   both driven by `summarize`.
10. **`src/locales/de.ts`** / **`es.ts`** — the bundled translations, one
    `Messages` catalog each, behind subpath imports so the core stays lean.

## The sources and fiat

11. **`src/adapters/mirror.ts`** — `fromMirror`: the primary, rich,
    unverified source (`@hiero-hackers/enterprise-mirror`).
12. **`src/adapters/stream.ts`** — `fromStream`: the verified, leaner source
    (`@hiero-hackers/streams-node`).
13. **`src/adapters/exchange-rate.ts`** — `usdPriceFromExchangeRate`: a real
    `PriceSource` from Hedera's on-chain exchange rate.

## Public surface & tests

- **`src/index.ts`** — the core exports. Adapters and locales are reached
  via subpaths (`@hiero-hackers/hiero-receipts/mirror`, `…/stream`,
  `…/locales/de`) so the core stays source-dependency-free.
- **`test/golden.test.ts`** — the whole pipeline pinned verbatim (English);
  `test/i18n.test.ts` does the same in German. Wording changes show up here
  as diffs a human signs off on.
- **`test/generate.test.ts`** — `receiptFor` from both the sender's and
  receiver's viewpoint, fee attribution, fiat, and the mirror adapter.

## One-paragraph mental model

The caller fetches a transaction (mirror or stream) and maps it through an
adapter into a `NormalizedTransaction`; `receiptFor` turns that into a
`Receipt` for one account; a renderer emits JSON/text/HTML. The source sets
the `provenance`. See [ARCHITECTURE.md](ARCHITECTURE.md) for the why.
