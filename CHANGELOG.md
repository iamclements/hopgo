# Changelog

All notable changes to Hopgo are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file is updated only in release commits. Feature and fix PRs do not touch it.

## [Unreleased]

## [0.1.1] - 2026-08-04

### Fixed

- Removed the `offline_access` OAuth scope: Cloudflare's self-managed OAuth clients don't
  support it and never issued a refresh token, so requesting it was misleading. You now
  re-authenticate from Options when your access token expires (see 0.1.0's known
  limitations)
- Dashboard and options pages now have responsive breakpoints; both previously had none
  despite opening as ordinary resizable browser tabs. The link table switches to
  horizontal scroll instead of squishing columns on narrow widths, and the domain setup
  form wraps instead of overflowing
- Marketing site (hopgo.co): decorative background glow elements could push page width
  past the viewport on unusual aspect ratios (e.g. foldable cover/inner screens); now
  clipped to `max-width: 100vw` with `overflow-x: hidden` applied to `html` as well as
  `body`

### Security

- Bumped `@cloudflare/vitest-pool-workers` to clear a Dependabot alert on a vulnerable
  transitive `sharp` version; dev-only (Workers test runner), never shipped to users

## [0.1.0] - 2026-08-04

### Added

- **Link manager dashboard** - full-page tab opened from the popup with search, sort,
  bulk delete, per-link expiry date picker, click stats column, domain selector, and
  configurable 404 redirect URL
- **workers.dev path** - deploy to a free Cloudflare workers.dev subdomain with no
  custom domain required; setup card in options surfaces this before asking for a domain
- **Link expiry** - `expiresAt` field on links maps to Cloudflare KV's native TTL;
  expired links are cleaned up automatically at the edge
- **Worker version tracking** - deployed Worker version is stored per domain; options
  page shows an "Update available" badge and one-click update when a newer version ships
- **Configurable 404 redirect** - set a `__404_redirect__` KV key to redirect unknown
  slugs to any URL instead of showing the default not-found page
- **Before you start callout** - options page shows a prerequisite summary (Cloudflare
  account required, workers.dev available) before any domain is configured

### Fixed

- KV namespace limit (100 max on free plan) now surfaces a human-readable error with a
  link to the Cloudflare dashboard instead of an opaque API failure
- Worker 404 page is now neutral with no Hopgo branding; users control the experience
  via the 404 redirect setting
- "No zones found" error in options now directs users to the workers.dev path instead
  of leaving them stuck

### Known limitations

- Cloudflare's self-managed OAuth clients don't issue refresh tokens: access tokens are
  not renewed silently, and you re-authenticate from Options once one expires. Fixed in
  0.1.1 to stop requesting the unsupported `offline_access` scope.
