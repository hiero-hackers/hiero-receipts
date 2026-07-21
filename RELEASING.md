# Releasing & operating this repo

The runbook for maintainers — everything that is not derivable from the code.

## One-time machine setup

GitHub Packages needs a `read:packages` token even for public packages:

```sh
gh auth refresh -s read:packages
npm config set //npm.pkg.github.com/:_authToken "$(gh auth token)"
```

(Re-run the second line if you ever re-login with `gh`.)

## One-time repo settings (already done for this repo; kept for reference)

1. **Package access** for the packages CI installs (`enterprise-mirror`,
   `streams-node`): package settings → _Manage Actions access_ → add this
   repo, Read. The CI examples job 401s until then.
2. **Pages** — Settings → Pages → Source: _GitHub Actions_ (API-docs deploy).
3. **Branch protection** on `main` requiring the CI checks and DCO.
4. Trigger the Scorecard workflow once so the badge populates.

## Cutting a release

```sh
# 1. bump "version" in package.json, land on main through a PR
# 2. tag the merge commit:
git switch main && git pull
git tag -s v0.2.0 -m "hiero-receipts 0.2.0"
git push origin v0.2.0
```

The tag push runs the gates (typecheck, lint, format, tests), checks the tag
equals `package.json`'s version, publishes to GitHub Packages, and cuts a
GitHub Release with auto-generated notes. Re-runs are idempotent — each half
skips or fails cleanly if already done.

Pre-1.0 semver: minor versions may break. Downstream
(`hiero-notifications`) pins `^0.1.0` (patches only), so a breaking change
means a coordinated minor bump there too. Cross-repo order when everything
moves: `hiero-streams-rs` → this repo → `hiero-notifications`.

## Wording is a contract

The text/HTML output is pinned VERBATIM by golden tests
(`test/golden.test.ts` English, `test/i18n.test.ts` German). A wording
change is a deliberate diff a human signs off on — and a reason to regenerate
`docs/receipt.png` (headless-Chrome screenshot; recipe in the git history of
that file) and to have locale catalogs re-reviewed. `toJSON` output is
specified by `schema/receipt.v1.schema.json`; a breaking shape change bumps
the schema filename and `$id`.

## Dependency policy

- **TypeScript majors are ignored by Dependabot on purpose**
  (`.github/dependabot.yml`): TS 7's native compiler drops the JS API that
  typescript-eslint and typedoc load. Revisit when the toolchain supports it.
- The org intends an eventual **npmjs migration** (no token wall, OIDC
  provenance, and `examples/setup.js` can then be deleted in favor of plain
  devDependencies). When it happens: drop `publishConfig.registry`, claim
  the scope, keep GitHub Packages during a transition.

## Maintenance notes

- **Coverage floors ratchet** (`vitest.config.ts`): raise them when coverage
  rises; never lower silently.
- **Adding a locale**: copy `src/locales/de.ts`, translate all entries (the
  type enforces completeness), add the subpath export in `package.json`,
  pin a verbatim golden test, note it in the README. Native review before
  customer-facing use.
- **Bumping `engines`**: also grep `.github/workflows` for hardcoded
  `node-version:` — Dependabot bumps actions, not these numbers.
