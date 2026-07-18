## What & why

<!-- One or two sentences: what changes, and what problem it solves. -->

## Checklist

- [ ] `npm run typecheck && npm run lint && npm run format:check && npm test` pass locally
- [ ] Every commit is signed off (`git commit -s` — the DCO check enforces this)
- [ ] New behavior is covered by a test (the golden receipt test must be
      updated deliberately if wording/format changed)
- [ ] Money stays `bigint` end to end — no `number` touches a value
- [ ] The core stays pure — no I/O in `src/` (fetching/rendering belongs to
      the caller or the examples)
