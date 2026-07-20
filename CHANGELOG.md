# Changelog

All notable changes to Hopgo are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file is updated only in release commits. Feature and fix PRs do not touch it.

## [Unreleased]

## [0.1.0] - 2026-07-20

### Added

- **Link manager dashboard** - full-page tab opened from the popup with search, sort,
  bulk delete, per-link expiry date picker, click stats column, domain selector, and
  configurable 404 redirect URL
- **workers.dev path** - deploy to a free Cloudflare workers.dev subdomain with no
  custom domain required; setup card in options surfaces this before asking for a domain
- **OAuth token auto-refresh** - tokens refresh silently in the background using the
  `offline_access` scope; users stay signed in indefinitely after first login
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
