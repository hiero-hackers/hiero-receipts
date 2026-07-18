# Security Policy

This project aligns with the security-reporting practices of the
[LF Decentralized Trust](https://lf-decentralized-trust.github.io/governance/governing-documents/SECURITY-POLICY)
ecosystem that the wider Hiero project follows.

## Reporting a vulnerability

Please **do not** open a public issue for anything you believe to be a
security vulnerability. Instead, use
[GitHub private vulnerability reporting](../../security/advisories/new)
("Report a vulnerability" under the repository's Security tab).

Include what you can: affected file/function, a proof-of-concept input, and
the impact you foresee. You will get an acknowledgement within a few days.

## Scope notes for reporters

Two areas of this library are security-relevant by design and welcome
scrutiny:

- **Renderer output** (`src/render/`): receipts are rendered into emails
  and PDFs from **attacker-writable ledger data** (memos in particular).
  Escaping and control-character handling are tested in
  `test/render.test.ts` — bypasses of those defenses are vulnerabilities.
- **Exact-money arithmetic** (`src/money.ts`, `src/adapters/`): anything
  that makes a rendered amount differ from the on-ledger amount is a
  vulnerability, not a rounding quirk.
