# Contributing to hiero-receipts

Thanks for considering a contribution! This project follows the practices of
the wider Hiero / LF Decentralized Trust ecosystem, including our
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Development setup

```sh
npm install
npm run typecheck   # tsc, strict
npm test            # vitest (unit + property tests)
npm run lint        # eslint (type-aware) + prettier as errors
npm run format      # prettier --write
npm run build       # emits dist/
```

All four gates (`typecheck`, `test`, `lint`, `format:check`) run in CI on
every push and pull request — please run them locally before opening a PR.

The **examples** additionally need the optional peer packages
(`@hiero-hackers/enterprise-mirror`, `@hiero-hackers/streams-node`) — run
`npm run examples:setup`, which places them without touching `package.json`
and explains anything still missing (see the README's "See it work" section).
The library itself and its tests have no runtime dependencies.

## Design ground rules

- **Money is `bigint`, everywhere.** No float ever touches a value;
  `number` inputs are widened at the adapter boundary (`toBigInt`).
- **The core is pure.** `receiptFor` and the renderers do no I/O; fetching
  transactions, rates, and decimals is the caller's job. Keep it that way —
  it is what makes the library portable and testable from fixtures.
- **Ledger free-text is hostile.** Memos are attacker-writable. Anything
  rendered must be escaped (HTML) and control-sanitized (text) — see the
  tests in `test/render.test.ts` that pin this, and add to them if you add
  a renderer.
- **Heuristics say so.** Anything derived rather than factual (counterparty,
  direction) is labeled a heuristic in code and pinned as one in tests.

## Sign your commits (DCO)

This project uses the [Developer Certificate of Origin](https://developercertificate.org/).
Every commit must be signed off:

```sh
git commit -s -m "feat: ..."
```

(`Signed-off-by: Your Name <you@example.com>` in the commit message.)

## Reporting security issues

Please do not open public issues for vulnerabilities — see
[SECURITY.md](./SECURITY.md).
