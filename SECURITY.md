# Security Policy

## Reporting a vulnerability

Please report security issues privately. Do not open a public issue for vulnerabilities.

- Preferred: open a private report via GitHub Security Advisories
  (the "Report a vulnerability" button under the repository's Security tab).
- Or email: contact@hopgo.co

Include steps to reproduce and the affected component (worker, extension, web, or shared). We aim to
acknowledge within a few days.

## Scope and design notes

Hopgo is built so that a compromise has a small blast radius:

- **No Hopgo server holds your data.** The extension talks directly to the Cloudflare API with an
  OAuth token that stays in your browser. Your links live in your own Cloudflare KV.
- **Scoped OAuth, no secrets shipped.** Sign-in uses a public OAuth client with PKCE (no client
  secret). The token is scoped to Workers KV, Workers Scripts/Routes, Zone read, and DNS write.
  Revoke it anytime in your Cloudflare dashboard under Connected Applications.
- **The redirect data plane is independent.** Once provisioned, redirects are served by a Worker in
  your own account; they keep working even if the extension is removed.

## Supported versions

This project is pre-1.0. Only the latest release receives security fixes.
