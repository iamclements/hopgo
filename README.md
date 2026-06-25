# Hopgo

Branded short links that live entirely on **your** Cloudflare account. No server to run, no host
to maintain: install the Chrome extension (or open the web app), sign in with Cloudflare, and your
links are served from your own domain at Cloudflare's edge.

**What makes it different:** every other shortener either runs on a box you babysit (YOURLS, Kutt,
Shlink) or stores your links on someone else's servers (Dub, Bitly). Hopgo does neither. The
redirects run as a tiny Cloudflare Worker on your domain, the data lives in your Cloudflare KV, and
Hopgo is just the control surface. There is nothing for you to host, and nothing of yours lives
with us.

- **Nothing to host.** No container, no VPS. Just an extension and a static web app.
- **You own everything.** Your Cloudflare account, your domain, your data. Revoke access anytime.
- **Edge-fast, always up.** Redirects are served by Cloudflare worldwide, not by any Hopgo server.

## How it works

- **Redirect Worker (data plane):** a small Cloudflare Worker bound to `yourdomain/*`. `GET /:slug`
  looks the slug up in KV and 302s to the target; clicks are counted async. It runs in your account.
- **Control surface:** the Chrome extension and the web app talk to the Cloudflare API directly
  using a short-lived OAuth token you grant. They create, list, and delete links in your KV.
- **Sign in with Cloudflare:** OAuth (Authorization Code + PKCE, no secret). You approve a minimal
  scope on Cloudflare's own consent screen; tokens stay in your browser and are never sent to Hopgo.

## Use it

- **Chrome extension:** shorten the current tab in one click, copy the short URL, see recent links.
- **Web app:** manage all your links, see click counts, create custom slugs.

Both are published from this repo. Install links land here once the first release ships (see Roadmap).

## Develop

pnpm workspace monorepo. Requires Node 22.13+ and pnpm.

```
hopgo/
  apps/
    worker/      # the redirect Worker deployed into the user's Cloudflare account
    web/         # static management web app (Vite, Cloudflare Pages)
    extension/   # Chrome MV3 extension
  packages/
    shared/      # types, Cloudflare API client, OAuth (PKCE), slug + link helpers
```

```bash
pnpm install
pnpm lint          # ESLint
pnpm format:check  # Prettier (separate step)
pnpm typecheck     # tsc --noEmit per package
pnpm test          # Vitest per package
```

## The redirect Worker

The Worker in [apps/worker](apps/worker) is the redirect data plane. `GET /:slug` resolves a slug
from KV to a 302; an unknown slug 404s; clicks are counted off the response path via `waitUntil`.
The apex root serves a small landing page.

In the product flow, Hopgo deploys this Worker into your account and binds it to a domain you pick
(coming in the provisioning release). To run it by hand today:

```bash
pnpm --filter @hopgo/worker dev      # local dev on Miniflare
pnpm --filter @hopgo/worker deploy   # wrangler deploy to your account
```

Set your KV namespace id and route in [apps/worker/wrangler.jsonc](apps/worker/wrangler.jsonc).

## Security

- **OAuth, not pasted tokens.** You sign in with Cloudflare and approve a minimal scope. The web
  app is a static SPA: the access token lives in the browser tab only and is dropped when it
  expires (re-login is one click). Nothing is persisted to a Hopgo server, because there is none.
- **Least privilege.** Hopgo asks only for what it needs (Workers KV; Workers Scripts/Routes and
  Zone read are requested only for the one-click Worker setup). Revoke anytime in your Cloudflare
  dashboard under Connected Applications.
- **Your data stays yours.** Links live in your KV; redirects run on your domain. Hopgo never sees
  your tokens or your links.

## Roadmap

Shipped: redirect Worker, shared Cloudflare client + OAuth (PKCE), slug/link helpers.

Next:

1. Web app: sign in with Cloudflare, manage links (create, list, delete, click counts).
2. Extension: sign in with Cloudflare, shorten the current tab.
3. One-click setup: provision the redirect Worker + route into your account on a domain you pick.
4. Release pipeline: publish the extension to the Chrome Web Store and the web app to Cloudflare Pages.

## License

[MIT](LICENSE)
