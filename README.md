# Hopgo

Self-hosted, branded URL shortener whose redirects live on **Cloudflare's edge**, not on your
box. Bring your own Cloudflare account and a domain you own.

**The point: your host is disposable.** Every other self-hosted shortener (YOURLS, Kutt, Shlink)
serves redirects from your server, so when the box dies every link 404s. Hopgo stores the
slug -> URL map in Cloudflare KV and serves redirects from a Cloudflare Worker. The management
container is only a control plane. Wipe it, redeploy it, lose zero links.

- **No inbound ports.** Redirects are served publicly by Cloudflare; the control-plane container
  stays LAN-only (or behind a Cloudflare Tunnel + Access).
- **Host dies, links survive.** The data lives in Cloudflare KV, not the container.
- **You own everything.** Your domain, your Cloudflare account, your data.

## Architecture

- **Data plane (always up):** a Cloudflare Worker bound to `hopgo.co/*`. `GET /:slug` looks up
  the slug in KV and issues a 302; unknown slug returns a branded 404. Clicks are counted async.
- **Control plane (disposable):** a Docker container running a Hono REST API plus a minimal web
  portal. It talks to the Cloudflare API with a scoped token to CRUD KV entries and read stats.
- **Chrome extension (MV3):** "shorten current tab" in one click, copy to clipboard, recent links.

## Repo layout

```
hopgo/
  apps/
    worker/          # Cloudflare Worker: edge redirect + click counter
    control-plane/   # Hono API + web portal (the Docker image)
    extension/       # Chrome MV3 extension
  packages/
    shared/          # shared types (Link, Tenant), slug utils, CF API client
```

## Development

Requires Node 20+ and pnpm. This is a pnpm workspace monorepo.

```bash
pnpm install            # install all workspace deps
pnpm lint               # ESLint across the repo
pnpm format:check       # Prettier (separate step from lint)
pnpm typecheck          # tsc --noEmit per package
pnpm test               # Vitest per package
```

## Cloudflare setup (owner does this once)

1. Add `hopgo.co` to Cloudflare (the zone may already exist if bought via CF Registrar).
2. Create a Workers KV namespace (e.g. `hopgo-links`).
3. Create a Worker and a route `hopgo.co/*` -> the Worker.
4. Create a **scoped** API token: Account > Workers Scripts:Edit + Workers KV Storage:Edit,
   limited to the one account. Put it in `.env` as `CF_API_TOKEN` (plus `CF_ACCOUNT_ID` and
   `CF_KV_NAMESPACE_ID`). Never use the Global API Key. Never commit `.env`.

See [.env.example](.env.example) for the full list of variables.

## Roadmap

Early development. This repo currently contains the scaffold (PR #1). Each item below is one PR.

1. `chore/scaffold` - pnpm monorepo, four packages, CLAUDE.md, README, MIT LICENSE, .env.example,
   ESLint/Prettier/tsconfig, CI (lint + typecheck + test). **(this PR)**
2. `feat/worker-redirect` - Worker: KV-backed `GET /:slug` -> 302, 404 fallback, async click
   counter. Miniflare tests. Wrangler config with the `hopgo.co/*` route.
3. `feat/shared-cf-client` - typed Cloudflare API client (KV read/write/list, scoped-token auth),
   `Link`/`Tenant` types (tenant-aware), slug generator + collision check.
4. `feat/control-plane-api` - Hono REST API: create, list, get, delete, click stats. Dockerfile +
   compose + non-root/PUID entrypoint.
5. `feat/control-plane-portal` - minimal web UI: list, create, delete, copy, click counts.
6. `feat/extension` - MV3 "shorten current tab," clipboard copy, recent links, settings.
7. `feat/doctor` - setup/preflight check (token scope, KV reachable, Worker route live, zone in CF).
8. `docs/readme + landing` - full setup docs and an optional static landing page.

## License

[MIT](LICENSE)
