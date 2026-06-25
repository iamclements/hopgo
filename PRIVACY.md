# Hopgo Privacy Policy

_Last updated: 2026-06-25_

Hopgo is a Chrome extension and open-source tool for creating short links on **your own**
Cloudflare account. This policy explains what data Hopgo handles.

## The short version

Hopgo does not run any servers and does not collect, store, sell, or transmit your data to us. The
extension talks **directly to Cloudflare** using an authorization you grant. Your links and your
Cloudflare credentials never pass through any Hopgo-operated service.

## What Hopgo stores, and where

- **Cloudflare OAuth access token** - obtained when you click "Sign in with Cloudflare" and stored
  locally in your browser via `chrome.storage.local`. It is sent only to Cloudflare's API as a
  Bearer token. It is never sent anywhere else. No refresh token is requested.
- **Your short-link domain and a cached copy of your link list** - stored locally in
  `chrome.storage.local` so the popup loads quickly. The authoritative copy of your links lives in
  your own Cloudflare KV namespace.

Hopgo requests these Cloudflare permissions, used only to manage your links and one-click setup:
Workers KV Storage, Workers Scripts, Workers Routes, Zone read, and DNS write.

## What Hopgo does not do

- No analytics, tracking, ads, or fingerprinting.
- No remote Hopgo server receives your tokens, links, or browsing activity.
- No selling or sharing of data with third parties.

## Third parties

Hopgo communicates only with **Cloudflare** (`api.cloudflare.com` and `dash.cloudflare.com`), to
which you authenticate directly. Cloudflare's handling of your account data is governed by
Cloudflare's own privacy policy.

## Your control

- Remove all locally stored data by signing out in the extension or uninstalling it.
- Revoke Hopgo's access anytime in your Cloudflare dashboard under
  Profile > Access Management > Connected Applications.

## Contact

Questions: contact@hopgo.co
