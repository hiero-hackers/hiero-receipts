# Examples

Setup (one command, one-time token) and the full walkthrough live in the
root README's ["See it work"](../README.md#see-it-work). Short version:
`npm run build && npm run examples:setup`, then run an example with `node`.

| File                                         | What it shows                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [`live-receipt.ts`](live-receipt.ts)         | A receipt from a **real mainnet transaction** via `@hiero-hackers/enterprise-mirror` (needs network)   |
| [`verified-receipt.ts`](verified-receipt.ts) | A **cryptographically verified** receipt from the committed block fixtures — fully offline             |
| [`render-pdf.js`](render-pdf.js)             | HTML → PDF via a headless browser already on your machine (the library itself never renders PDFs)      |
| [`setup.js`](setup.js)                       | Fetches the two example-only packages from GitHub Packages (`npm run examples:setup`)                  |
| `fixtures/`                                  | HIP-1056 **preview-network** blocks (`0.blk.gz` genesis, `467.blk.gz`) — see verified-receipt's header |
| `output/`                                    | Where rendered receipts land (gitignored)                                                              |

Each example's header comment is its real documentation — start there.
