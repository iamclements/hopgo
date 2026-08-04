<p align="center">
  <img src="docs/images/banner.svg" alt="Hopgo" width="600">
</p>

Branded short links that run entirely on your own Cloudflare account. Install the Chrome extension, sign in with Cloudflare, and your links are served from your domain at Cloudflare's edge — no server, no container, nothing of yours ever touches a Hopgo machine.

[![CI](https://github.com/iamclements/hopgo/actions/workflows/ci.yml/badge.svg)](https://github.com/iamclements/hopgo/actions/workflows/ci.yml)
[![Security Scan](https://github.com/iamclements/hopgo/actions/workflows/security.yml/badge.svg)](https://github.com/iamclements/hopgo/actions/workflows/security.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## The idea

Every other URL shortener either runs on a box you babysit (YOURLS, Kutt, Shlink) or stores your links on someone else's servers (Dub, Bitly). Hopgo does neither.

The redirects run as a tiny Cloudflare Worker on your domain. The link data lives in your Cloudflare KV. Hopgo is just the control surface — a Chrome extension that talks to the Cloudflare API directly using a short-lived OAuth token you grant. There is nothing to host, and nothing of yours lives with us.

**Your redirects survive even if you uninstall the extension or Hopgo disappears.** They are served by Cloudflare from your account; Hopgo is never in the critical path.

---

## Quickstart

Already have a Cloudflare account and Chrome? Here is the short path:

1. Install the extension from the [Chrome Web Store](https://chromewebstore.google.com/detail/hopgo/hldildkeodeaabmlmgcfelcohfcegegb)
2. Open the extension's Options and click **Sign in with Cloudflare**
3. Choose a domain (or use the free workers.dev path — no domain required)
4. Click **Deploy** — Hopgo provisions the Worker and KV namespace into your account
5. Open any tab, click the extension icon, and shorten

---

## What you need

- **Chrome** (any recent version)
- **A free Cloudflare account** — no credit card required; sign up at [dash.cloudflare.com](https://dash.cloudflare.com)
- **A domain on Cloudflare** _(optional)_ — if you have one, short links live at `go.yourdomain.com`. If you don't, the free workers.dev path gives you `hopgo.<your-subdomain>.workers.dev` with no setup.

That's it. No server. No Docker. No VPS.

---

## How it works

```
Chrome extension
      │
      │  Cloudflare API (OAuth PKCE)
      ▼
┌─────────────────────────────────────┐
│  Your Cloudflare account            │
│                                     │
│  Worker  ──── KV namespace          │
│  go.yourdomain.com/*                │
│  ↳ GET /:slug → 302 to target       │
│  ↳ click counted via waitUntil      │
└─────────────────────────────────────┘
```

1. You click the extension on any tab
2. The extension calls the Cloudflare API to write `slug → URL` into your KV
3. A visitor hits `go.yourdomain.com/slug` — the Worker reads KV and 302s them
4. Clicks are counted asynchronously so the redirect is never delayed

The extension also ships a full link manager dashboard that opens in a new tab directly from the extension — no external site needed.

---

## Setup

### Step 1: Install the extension

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/hopgo/hldildkeodeaabmlmgcfelcohfcegegb), or load it unpacked from source (see [Develop](#develop)).

### Step 2: Sign in with Cloudflare

Open the extension's Options (gear icon in the popup, or `chrome://extensions` → Details → Extension options).

Click **Sign in with Cloudflare**. An OAuth consent screen opens on Cloudflare's own domain. Approve the minimal scope — Hopgo only asks for Workers Scripts, KV, and Zone read. Your token stays in the extension; it is never sent to a Hopgo server.

> Tokens refresh silently in the background using the `offline_access` scope. You sign in once and stay signed in.

### Step 3: Deploy the redirect Worker

**No custom domain?** Click **Deploy to workers.dev** in the Options page. Hopgo provisions the Worker and a KV namespace into your account and gives you a free `hopgo.<your-subdomain>.workers.dev` URL. No DNS setup needed.

**Have a domain on Cloudflare?** Under **Custom domain setup**, enter a subdomain prefix (e.g. `go`), pick your domain from the dropdown, and click **Deploy**. Hopgo:

1. Creates a `hopgo-links-<domain>` KV namespace in your account
2. Deploys the redirect Worker under your account
3. Binds `go.yourdomain.com/*` to the Worker
4. Creates a proxied DNS record automatically

> If DNS creation fails (happens when Cloudflare's API returns a zone-record conflict), Hopgo reports the error and tells you to add a proxied AAAA record manually pointing to `100::`.

### Step 4: Shorten a link

Click the extension icon on any tab. Edit the slug if you want something specific — or leave it blank and Hopgo generates a short random one. Click **Shorten**. The short URL is copied to your clipboard immediately.

### Step 5: Manage your links

Click **Manage all links →** at the bottom of the popup to open the dashboard tab. From there you can:

- Search and sort all your links
- Bulk delete
- Set expiry dates (backed by Cloudflare KV's native TTL)
- View click counts
- Set a custom 404 redirect URL for unknown slugs

---

## Develop

pnpm workspace monorepo. Requires Node 22.13+ and pnpm.

```
hopgo/
  apps/
    worker/      # the redirect Worker deployed into the user's Cloudflare account
    extension/   # Chrome MV3 extension (popup, options, dashboard)
    site/        # marketing site at hopgo.co (static HTML/CSS, GitHub Pages)
  packages/
    shared/      # types, Cloudflare API client, OAuth (PKCE), link helpers
```

```bash
pnpm install
pnpm lint          # ESLint
pnpm format:check  # Prettier (separate CI step)
pnpm typecheck     # tsc --noEmit per package
pnpm test          # Vitest per package
```

**Extension:**

```bash
pnpm --filter @hopgo/extension build   # outputs to apps/extension/dist
```

Load it in Chrome: `chrome://extensions` → Developer mode → Load unpacked → pick `apps/extension/dist`.

After loading, open Options, copy the displayed **OAuth redirect URL**, and add it to your Cloudflare OAuth client's redirect URIs. Then sign in and deploy.

**Worker (local dev):**

```bash
pnpm --filter @hopgo/worker dev      # Miniflare local dev server
pnpm --filter @hopgo/worker deploy   # wrangler deploy to your account
```

Set your KV namespace ID and route in [apps/worker/wrangler.jsonc](apps/worker/wrangler.jsonc).

**Marketing site:**

```bash
python3 -m http.server -d apps/site/public 8080
```

Pushing to `main` with changes under `apps/site/**` deploys automatically via GitHub Pages.

---

## Releasing

Releases are published to the Chrome Web Store automatically when a version tag is pushed:

```bash
git tag v0.2.0
git push origin v0.2.0
```

The `release.yml` workflow sets the manifest version from the tag, builds the extension, and uploads it via `chrome-webstore-upload-cli`. Four secrets are required in the repository: `CWS_EXTENSION_ID`, `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`.

---

## Security

**OAuth, not pasted tokens.** The extension uses Authorization Code + PKCE via `chrome.identity`. No client secret is embedded. Tokens are stored in `chrome.storage.local` and are never sent to a Hopgo server (there isn't one).

**Least privilege.** Hopgo requests only what it needs: Workers KV namespace read/write, Workers Scripts deploy, and Zone read for one-click DNS setup. Revoke access anytime under **Connected Applications** in your Cloudflare dashboard.

**Your data stays yours.** Links live in your KV. Redirects run on your Worker. Hopgo never sees your tokens, your slugs, or your destinations.

See [SECURITY.md](SECURITY.md) for the vulnerability disclosure policy.

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines and [SECURITY.md](SECURITY.md) for the vulnerability disclosure policy.

Use the provided issue templates for [bug reports](.github/ISSUE_TEMPLATE/bug_report.md) and [feature requests](.github/ISSUE_TEMPLATE/feature_request.md).

---

## License

[MIT](LICENSE)
