---
name: relay-maintain
description: Work on the open.relay repository itself. Use when changing the packages, running tests, editing docs/, keeping the no-Signals rule, or releasing a new version.
---

Two npm packages in a workspace: `packages/core` (`@journey-to-code/relay`: server, client, tidy) and `packages/ui` (`@journey-to-code/relay-ui`: flows, React, CSS). Node 22.12 or later.

## Commands

- `npm test` builds both, then runs vitest in each.
- `npm run typecheck` builds, then type-checks every workspace.
- Docs build: see `docs/agents.md#editing-these-docs`.

Finish a change only when `npm run typecheck` and `npm test` both pass.

## Rules that are easy to break

- **No Signals API** in either package, in source or dependencies. `packages/core/test/no-signals.test.ts` fails if it appears (the TC39 proposal is Stage 1 and not for production).
- **Nothing identifying in a public issue.** Server output must not contain a token, IP, cookie or a `ref`. `enrich` lines are public by design.
- **Person-facing errors** are plain sentences the client shows as they are. Keep that when adding a failure.
- **The client wraps `console.error`.** Keep `watchForErrors` reversible.
- **Docs match the code.** When an option, default, limit, route or status changes, change `docs/` in the same PR. Link pages as `file.md` so links work on GitHub and the site.
- A link to open.parlor must not go in docs or skills (it is going private).

## Releasing

Bump `version` in each changed package's `package.json` in a PR and merge. `.github/workflows/release.yml` (the Release on Bump action) publishes versions not on npm yet, with provenance, then tags `relay-v<version>` and `relay-ui-v<version>` and creates GitHub releases. If `relay-ui` needs a new `relay`, bump both and raise the dependency range. A failed run is safe to re-run from the Actions tab. Details: `docs/releasing.md`.

## Docs

`docs/` is Markdown with `order` in the front matter; it is built to GitHub Pages by `.github/workflows/docs-pages.yml`, pinned to one open.blog commit (`OPENBLOG_REF`). A pull request builds and checks the site; only `main` publishes. Setting up Pages needs Settings, Pages, Source: GitHub Actions, once.
