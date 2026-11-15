---
order: 7
---

# Releasing

You bump a version in a pull request. Merging it releases.

## How a release goes

1. In a PR, change `version` in the `package.json` of each package that changed: `packages/core` for `@journey-to-code/relay`, `packages/ui` for `@journey-to-code/relay-ui`. If `relay-ui` needs a new `relay`, bump both, and raise the `@journey-to-code/relay` range in `relay-ui`'s dependencies.
2. Merge it to `main`.
3. [`release.yml`](https://github.com/journey-to-code-org/open.relay/blob/main/.github/workflows/release.yml) runs. It builds, type-checks and tests first, so a broken `main` publishes nothing. It then publishes every package whose version is not on npm yet, `relay` before `relay-ui`, with provenance, and gives each one a tag and a GitHub release with generated notes: `relay-v<version>` and `relay-ui-v<version>`.

A push that changes no version does nothing, including every docs change. Versions follow semver; a version with a `-` in it (`0.2.0-rc.1`) goes out under the `next` tag and is released as a prerelease.

## It is safe to run again

If a run stops partway, open the **Actions** tab, choose **Release**, and **Run workflow** on `main`. A version already on npm is skipped, and one that already has a GitHub release is skipped, so a re-run finishes whatever is missing.

## No token is stored

npm trusts the workflow instead of a secret. For each package, on npmjs.com, under **Settings → Trusted publishing → GitHub Actions**:

| Field | Value |
| --- | --- |
| Organization | `journey-to-code-org` |
| Repository | `open.relay` |
| Workflow | `release.yml` |
| Environment | `release` |
| Allowed action | `npm publish` |

These must match exactly, or npm answers `E404` even though the package exists. The workflow's environment is also named `release`, and can be limited to `main` in the repository's settings.

A **new package** cannot be set up until it exists, so publish its first version by hand (`npm publish --access public`), then add the trusted publisher.

## The action behind it

The work is done by [Release on Bump](https://github.com/journey-to-code-org/release-on-bump), a GitHub Action extracted from the release workflows of the `open.*` repositories. `release.yml` is only the part npm trusts: the permissions, the environment and one `uses:` line.

## Docs

The pages you are reading are in `docs/`, published to GitHub Pages by `docs-pages.yml` whenever they change on `main`. Publishing them is separate from releasing the packages and does not touch npm. See [For agents](agents.md#editing-these-docs) for how to build them locally.
