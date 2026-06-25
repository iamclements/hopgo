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

## Chrome extension

The MV3 extension in [apps/extension](apps/extension) signs in with Cloudflare (OAuth, PKCE via
`chrome.identity`) and talks to the Cloudflare API directly, so it needs no backend. It shortens the
current tab into your `hopgo-links` KV namespace and copies the short URL.

```bash
pnpm --filter @hopgo/extension build   # outputs apps/extension/dist
```

Load and connect:

1. Open `chrome://extensions`, enable Developer mode, "Load unpacked," pick `apps/extension/dist`.
2. Open the extension's Options. Copy the shown **OAuth redirect URL** and add it to your Cloudflare
   OAuth client's redirect URIs.
3. Open the popup and click **Sign in with Cloudflare**, approve the scopes.
4. Back in Options, under **One-click domain setup**, click **Load domains**, pick one, and
   **Deploy**. Hopgo deploys the redirect Worker into your account, binds `yourdomain/*` to it, and
   sets your short-link domain. Now shorten any tab from the popup.

If you already run your own Worker, skip step 4 and just set the short-link domain manually (it must
be bound to the `hopgo-links` KV namespace).

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

Shipped: redirect Worker, shared Cloudflare client + OAuth (PKCE) + account/zone/namespace
discovery, slug/link helpers, the Chrome extension (sign in with Cloudflare, shorten the current
tab), and one-click domain setup (deploy the Worker + bind the route into your account).

Next:

1. Web app: a static frontend plus a thin Cloudflare Worker backend (Cloudflare's API has no CORS,
   so a browser page needs a proxy) to manage links from anywhere.
2. Release pipeline: publish the extension to the Chrome Web Store and the web app to Cloudflare Pages.

## License

[MIT](LICENSE)
