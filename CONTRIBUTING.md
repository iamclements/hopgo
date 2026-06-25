# Contributing to Hopgo

Thanks for helping. Hopgo is a pnpm monorepo: a Cloudflare Worker (the data plane), a Hono
control plane (the disposable container), a Chrome extension, and a shared package.

## Setup

Requires Node 22.13+ and pnpm.

```bash
pnpm install
```

## Before you commit

All four gates must pass. CI runs the same ones.

```bash
pnpm lint            # ESLint
pnpm format:check    # Prettier (separate step from lint)
pnpm typecheck       # tsc --noEmit per package
pnpm test            # Vitest per package
```

Run `pnpm format` to auto-fix formatting.

## Commits

- Conventional prefixes only: `feat:`, `fix:`, `ci:`, `docs:`, `chore:`. `style:` is not valid;
  use `chore:` for formatting and lint fixes.
- No AI attribution trailers.
- Never commit directly to `main`. Branch first, open a PR.

## Branches

- Create a branch before any commit: `feat/`, `fix/`, `docs/`, `ci/`, or `chore/` plus a
  kebab-case description. Match the prefix to the commit type.

## Pull requests

Use this structure (plain text headers, no markdown `##`):

```
Summary
- What changed (one bullet per logical change)
- Why it matters

Setup note (optional)

Test plan
- [ ] Specific step with expected outcome
- [ ] CI lint, type check, and tests pass
```

## Docs sync

Any PR that changes functionality, commands, config, or the OAuth scopes updates the relevant docs
in the same commit: `README.md` and any config examples. `CHANGELOG.md` is touched only in release
commits.

## Style

- No em dashes anywhere: use colons, hyphens, or split sentences.
- TypeScript strict mode. Prefer small, typed modules.

## Releasing the extension

Publishing to the Chrome Web Store is automated by
[.github/workflows/release.yml](.github/workflows/release.yml), triggered when a `v*` tag is
pushed. The workflow sets the manifest version from the tag, builds, and uploads with auto-publish.

One-time setup (repo secrets):

- `CWS_EXTENSION_ID` - the extension id from the Chrome Web Store dashboard.
- `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN` - Google OAuth credentials for the
  Web Store API (see the chrome-webstore-upload docs on generating Google API keys).

To cut a release: bump `CHANGELOG.md` (move `[Unreleased]` to the new version), commit, then
`git tag vX.Y.Z && git push --tags`. CI publishes it.
