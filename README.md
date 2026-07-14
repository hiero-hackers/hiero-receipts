# hiero-receipts (TypeScript)

Human-readable, **provenance-stamped** transaction receipts for Hedera. One
transaction, seen from one account — direction, counterparty, net movement,
fee, memo, optional fiat — with a stamp saying whether it was
*cryptographically verified* or merely *mirror-sourced*. Prototype.

The receipts-tier twin of
[`hiero-journal`](https://github.com/hiero-hackers/hiero-journal-rs): one
transaction for a person, rather than an aggregate ledger for an auditor.

## The idea in one line

`receiptFor(account, transaction) → Receipt`, then render — with the data
source (mirror or verified stream) pluggable, and the receipt's provenance
telling the truth about which you used.

## Two sources, your choice

```ts
import { receiptFor, toHTML } from "hiero-receipts";

// Convenient path — @hiero-enterprise/mirror (rich, unverified)
import { fromMirror } from "hiero-receipts/mirror";
const tx = await mirrorClient.queryTransaction(id);
const receipt = receiptFor(account, fromMirror(tx));            // provenance: unverified

// Verified path — @hiero-streams/node (leaner, cryptographically proven)
import { fromStream } from "hiero-receipts/stream";
const parsed = JSON.parse(parseBlockJson(bytes));
const proof  = JSON.parse(verifyBlockProofJson(bytes, genesis));
const verified = receiptFor(account, fromStream(parsed, proof)); // provenance: verified{block,scheme}

toHTML(receipt); // → self-contained styled receipt (email / print to PDF)
```

The **core depends on neither source package** — each adapter is opt-in
(`hiero-receipts/mirror`, `hiero-receipts/stream`), and the caller owns the
client (the I/O). See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the
richness-vs-proof trade-off between the two sources.

## What's in the box

- **Plain language** — receipts read "You sent 250 ℏ to 0.0.8891" / "You
  earned a staking reward of 12.5 ℏ", with the fee stated separately and the
  date in readable UTC. No `direction: out` / `counterparty` jargon.
- **Exact money** — every amount is a `bigint` in the smallest unit; `number`
  is never used for a value (it's a lossy float above 2^53).
- **Real fiat, at the right time** — `usdPriceFromExchangeRate(s)` value HBAR
  by Hedera's **on-chain** exchange rate (the one used to price fees), fetched
  via `@hiero-enterprise/mirror`'s `queryExchangeRates()`. The rate changes
  over time, so a receipt is valued at the rate in effect **at its
  transaction's timestamp** — fetch it as-of that timestamp, or load rate
  windows and let the source pick. Exact rational math; labelled approximate,
  never claimed as provable.
- **Renderers** — `toJSON` (machine-readable), `toText` (email/SMS), `toHTML`
  (styled, print-friendly).

## Reading data & producing PDFs — the I/O boundary

`hiero-receipts` is **pure**: it turns a transaction *object* into a receipt
and never touches the network, the filesystem, or a rendering engine. Two
consequences worth knowing up front:

**The data is the caller's to fetch.** `fromMirror` / `fromStream` accept a
transaction object *regardless of where it came from* — the library never
reads it for you. Fetch it in your own code and pass the result to
`fromMirror` (`examples/live-receipt.ts` does exactly this against mainnet):

```ts
// in an app, with @hiero-enterprise/mirror:
const { transactions } = await mirrorClient.queryTransactionsByAccount(account);
const { currentRate }  = await mirrorClient.queryExchangeRates({ timestamp: transactions[0].consensus_timestamp });
const receipt = receiptFor(account, fromMirror(transactions[0]), { prices: usdPriceFromExchangeRate(currentRate) });
```

(The offline correctness of the maths is covered by the tests, from fixtures —
so there is no need for a made-up "sample" example.)

**PDFs.** `toHTML` returns a self-contained, **print-ready** receipt (it
carries `@media print` styles). Producing a PDF needs a rendering engine, so
it's a step in *your* app, not the library:

```sh
# any browser: open the HTML → Print → Save as PDF, or headless:
chrome --headless --no-pdf-header-footer --print-to-pdf=receipt.pdf receipt.html
```

```ts
// or with Puppeteer inside your app:
await page.setContent(toHTML(receipt));
await page.pdf({ path: "receipt.pdf" });
```

## What's out of scope

Fetching transactions, persistence, delivery, PDF rendering, and secrets.
`hiero-receipts` produces a receipt from an already-fetched transaction and
returns it as data or markup; anything I/O is the caller's. Keeping it pure is
what makes it portable and testable from a fixture.

## See it work — live, on real data

```sh
npm install && npm run build

node examples/live-receipt.ts               # a real recent mainnet transfer
node examples/live-receipt.ts 0.0.1234      # or a specific account's latest
```

`live-receipt` runs the whole pipeline on a **real** transaction from the
mainnet mirror node: it fetches the transaction, the exchange rate *as of that
transaction's timestamp*, and any token decimals, builds the receipt, prints
it, and writes `live.receipt.html` + `live.receipt.pdf`. The PDF is rendered by
a headless browser found on your machine (see `examples/render-pdf.js`) — which
is exactly what an app would do; the pure library itself never renders a PDF.

It fetches with plain `fetch` to stay dependency-free; in an app you'd swap in
`@hiero-enterprise/mirror`, which returns the same objects.

## Develop

```sh
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run build       # → dist/
```

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — the boundary, the two-source design, provenance, invariants
- [docs/CODE-TOUR.md](docs/CODE-TOUR.md) — a guided reading order

## Status

Early prototype. Mirror path is the primary, working target; the verified
`stream` path is present but lighter. NFT/memo/decimals flow through the
mirror source today; the same on the verified source depends on upstream
`hiero-streams` exposing them.

## License

Apache-2.0
