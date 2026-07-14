# Architecture

`hiero-receipts` turns a single Hedera transaction into a **human-readable
receipt**, seen from one account's point of view — direction, counterparty,
net movement, fee, memo, an optional fiat value — with a **provenance stamp**
that says whether the data was *cryptographically verified* or merely
*mirror-sourced*.

It is the receipts-tier twin of [`hiero-journal`](https://github.com/hiero-hackers/hiero-journal-rs):
one transaction for a person, rather than an aggregate ledger for an auditor.

## The one boundary that defines it

`hiero-receipts` is only two steps of a larger pipeline — **generate** and
**render**. Fetching the transaction and doing anything with the receipt
afterwards live outside it:

```
[fetch tx]   →   GENERATE receipt   →   RENDER receipt   →   [use it]
  ✗ caller         ✓ core                ✓ core             ✗ caller
```

Everything on the ✗ side — network fetching, any persistence, any delivery,
and all secrets — is the caller's concern. The library is a pure function:
**transaction in → receipt out → format out.** No I/O, no secrets.

## Two sources, one core — your choice

The core consumes a single source-agnostic [`NormalizedTransaction`]. Two
opt-in adapters map real sources into it, and the source you pick sets the
receipt's provenance:

```
core: hiero-receipts          NormalizedTransaction → Receipt → render   (zero source deps)
        ▲                            ▲
        │ fromMirror()               │ fromStream()
hiero-receipts/mirror         hiero-receipts/stream          ← opt-in adapters (peerDeps)
   └ @hiero-enterprise/mirror     └ @hiero-streams/node
```

- **`hiero-receipts/mirror`** — the primary path. Maps
  `@hiero-enterprise/mirror`'s `MirrorTransaction`. **Rich** (HBAR, tokens,
  NFTs, memo, decimals available), **`unverified`** (operator-attested).
- **`hiero-receipts/stream`** — the verified path (secondary). Maps
  `@hiero-streams/node`'s parsed output plus a proof result. **`verified`**
  (recomputed root + threshold signature), but **leaner**.

The core depends on *neither* source package — each adapter reads a
structurally-typed subset, so a real `MirrorTransaction` / parsed object
satisfies it without a hard dependency. The **caller** owns the client (the
I/O) and hands plain objects to the adapter.

## The richness / proof trade-off (be honest about it)

The two sources are not equally rich, and the design must not pretend they
are:

| | mirror | stream |
|---|---|---|
| Provenance | `unverified` | **`verified`** ✓ |
| NFT transfers | ✓ | ✗ (not in the parsed shape) |
| Memo | ✓ | ✗ |
| Token decimals | ✓ (`queryTokenById`) | ✗ |
| Ergonomics | typed objects | JSON to parse |

So **verified receipts carry less detail than mirror receipts** — you trade
richness for provability. `NormalizedTransaction` is therefore
**common-core required, rich-fields optional**; each adapter fills what its
source has, and renderers degrade gracefully when an optional is absent. The
`provenance` field keeps it honest. (Closing this gap upstream — exposing
memo/NFT/decimals on the stream parser — is the roadmap to *rich verified
receipts*.)

## Invariants

1. **Exact integer money.** Every amount is a `bigint` in the asset's
   smallest unit (tinybar for HBAR). `number` is never used for a value —
   it is an IEEE-754 double, and a large token amount exceeds its 2^53 safe
   range. Amounts are converted to `bigint` at the adapter boundary; decimals
   affect *display* only. (`money.ts`)
2. **Purity.** The core performs no I/O. Fetching and token-info lookups are
   the caller's job, so a receipt is reproducible from its inputs and
   trivially testable from a fixture.
3. **Honest provenance.** A receipt is only stamped `verified` when a valid
   proof was supplied; a stream transaction with no valid proof is
   `unverified` — never mislabelled.

## Module responsibilities

| Module | Responsibility |
|---|---|
| `money.ts` | Exact `bigint` arithmetic + formatting. |
| `normalized.ts` | `NormalizedTransaction` — the source-agnostic input, and `Provenance`. |
| `receipt.ts` | The `Receipt` data model. |
| `generate.ts` | `receiptFor(account, tx)` — direction, counterparty, movements, fee, staking reward, fiat. |
| `summary.ts` | Plain-language wording ("You sent 250 ℏ to 0.0.8891") + date formatting — shared by the text and HTML renderers so they stay consistent. |
| `render/{json,text,html}.ts` | Presentations of a `Receipt` (JSON is machine-readable; text/HTML are plain-language). `toHTML` is self-contained and print-ready — a PDF is one headless-browser call away, in the caller. |
| `adapters/mirror.ts` | `fromMirror` — the primary, rich, unverified source (HBAR, tokens, NFTs, staking rewards, memo). |
| `adapters/stream.ts` | `fromStream` — the verified, leaner source. |
| `adapters/exchange-rate.ts` | `usdPriceFromExchangeRate(s)` — real `PriceSource`s from Hedera's **on-chain** exchange rate (via `@hiero-enterprise/mirror`), valued at the rate in effect at the transaction's timestamp. |
| `prices.ts` | `PriceSource` — pluggable, approximate fiat (exact rational valuation). |

## What's a fact, what's an estimate

A receipt mixes two kinds of statement, and the difference is testable. **Facts**
are exact and derived straight from the ledger data; **estimates** are
heuristics or approximations that could reasonably be computed differently.

| Fact (exact) | Estimate / judgement |
|---|---|
| Amounts moved (tinybar / base units) | **Counterparty** — a heuristic (largest opposite leg); a guess in a multi-party transaction |
| The network fee | **Fiat value** — approximate: a rate, not a market price, rounded to the cent (shown with `≈`) |
| Consensus timestamp, success/failure | **Direction `internal`** — a judgement when an account both sends and receives |
| Staking-reward amount, NFT serials | The assumption the whole principal went to the one counterparty (exact for a simple transfer, approximate otherwise) |
| Sent-vs-fee split (`sent = |net| − fee`) | |
| Whether the data was verified | |

**Testing follows the split** (see `test/`):

- **Facts are asserted as invariants** — property-based tests
  (`maths.property.test.ts`) generate thousands of random inputs and check
  exactness: `render` round-trips losslessly, the sender's amount equals the
  receiver's, and exchange-rate valuation matches the exact rational formula
  (even past 2^53, where a float would drift).
- **Estimates are *pinned*, not proven** — example tests fix the current
  heuristic behaviour so a change is visible in review, but they are labelled
  as pinning a heuristic, not asserting a universal truth.

## Non-goals

Fetching, persistence, delivery, **PDF rendering**, and secrets are out of
scope: a receipt is produced from an already-fetched transaction and returned
as data or markup. Anything I/O — network, storage, a rendering engine,
credentials — is the caller's, so the library stays pure, portable, and
testable from a fixture. (`toHTML` is print-ready, so the PDF step is a single
headless-browser/Puppeteer call there.)

## The family

**receipt** (one tx, a person) → **statement** (a period) → **assurance
report** (verified aggregate)
`hiero-receipts` · · · · · · · · · · · · · · · · · · · · `hiero-journal`

Both compose an existing lower layer instead of rebuilding it —
`hiero-receipts` on `@hiero-enterprise/mirror` (and optionally
`@hiero-streams/node`), `hiero-journal` on `hiero-streams`.

See [CODE-TOUR.md](CODE-TOUR.md) for a reading order.
