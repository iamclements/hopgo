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

Requires Node 22.13+ and pnpm. This is a pnpm workspace monorepo.

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

## Worker (the data plane)

The edge redirect lives in [apps/worker](apps/worker). `GET /:slug` looks the slug up in KV and
302s to the target; an unknown slug returns a 404; clicks are counted async via `waitUntil`, off
the response path. The apex root (`/`) serves a small branded landing page.

```bash
pnpm --filter @hopgo/worker dev      # local dev on Miniflare (workers.dev preview)
pnpm --filter @hopgo/worker test     # Vitest on the real Workers runtime
pnpm --filter @hopgo/worker deploy   # publish + attach the hopgo.co/* route
```

Before deploying, set the KV namespace id in [apps/worker/wrangler.jsonc](apps/worker/wrangler.jsonc)
(the `LINKS` binding). Create the namespace with `wrangler kv namespace create hopgo-links`. The
`hopgo.co/*` route is declared there too and binds on deploy.

## Control plane (the disposable container)

The management API lives in [apps/control-plane](apps/control-plane): a Hono REST API that CRUDs
links in Cloudflare KV via the scoped token. It holds no state of its own. Wipe the container,
redeploy it, lose zero links. Bind it to LAN only; for remote admin put a Cloudflare Tunnel +
Access in front rather than opening a port.

It also serves a minimal web portal at `/`: list links with click counts, create (auto or custom
slug), copy the short URL, and delete. The portal is plain HTML/JS served by the same process, so
there is no separate frontend to build or host. Open `http://<host>:8787/` on your LAN.

### Run with Docker

```bash
cp .env.example .env          # fill in your scoped token, account id, KV namespace id
docker compose up -d          # builds the image and starts the container on 127.0.0.1:8787
curl http://127.0.0.1:8787/health
```

Local dev without Docker:

```bash
pnpm --filter @hopgo/control-plane dev     # tsx watch on the source
pnpm --filter @hopgo/control-plane build   # bundle to dist/ (what the image runs)
pnpm --filter @hopgo/control-plane test    # Vitest against an in-memory KV
```

### Environment variables

| Variable                | Required | Default            | Purpose                                                                      |
| ----------------------- | -------- | ------------------ | ---------------------------------------------------------------------------- |
| `CF_API_TOKEN`          | yes      | -                  | Scoped Cloudflare token (Workers KV Storage edit). Never the Global API Key. |
| `CF_ACCOUNT_ID`         | yes      | -                  | Account that owns the KV namespace.                                          |
| `CF_KV_NAMESPACE_ID`    | yes      | -                  | KV namespace id holding the links.                                           |
| `HOPGO_TENANT_ID`       | no       | `local`            | Tenant stamped onto created links.                                           |
| `HOPGO_PUBLIC_BASE_URL` | no       | `https://hopgo.co` | Origin the portal uses to build copyable short links.                        |
| `HOST`                  | no       | `127.0.0.1`        | Bind address. Compose sets `0.0.0.0` inside the container and maps to LAN.   |
| `PORT`                  | no       | `8787`             | Listen port.                                                                 |
| `PUID` / `PGID`         | no       | `1000`             | Host user/group ids the container drops to (Docker only).                    |

### API

| Method   | Path                      | Body                               | Result                                             |
| -------- | ------------------------- | ---------------------------------- | -------------------------------------------------- |
| `GET`    | `/health`                 | -                                  | `{ "status": "ok" }`                               |
| `POST`   | `/api/links`              | `{ "url": "...", "slug"?: "..." }` | `201` with the created link (auto slug if omitted) |
| `GET`    | `/api/links?limit&cursor` | -                                  | `{ "links": [...], "cursor"?: "..." }`             |
| `GET`    | `/api/links/:slug`        | -                                  | the link plus its `clicks` count, or `404`         |
| `DELETE` | `/api/links/:slug`        | -                                  | `204`, or `404` if unknown                         |

### Doctor (preflight check)

Before you rely on the setup, run the preflight check. It verifies required env, that the scoped
token is active, that the KV namespace is reachable, and that the worker is serving redirects.

```bash
pnpm --filter @hopgo/control-plane doctor          # local, reads your shell env / .env
docker compose run --rm control-plane node dist/doctor.js   # inside the container
```

It prints one line per check (`✓` pass, `✗` fail, `!` warn, `-` skipped) and exits non-zero if any
check fails, so it is safe to gate a deploy on it.

## Chrome extension

The MV3 extension in [apps/extension](apps/extension) shortens the current tab in one click, copies
the short URL to the clipboard, and keeps a list of recent links. It talks to your control-plane
API, so set that URL in the extension options first.

```bash
pnpm --filter @hopgo/extension build   # outputs apps/extension/dist
pnpm --filter @hopgo/extension dev      # rebuild on change (vite build --watch)
```

Load it: open `chrome://extensions`, enable Developer mode, choose "Load unpacked," and pick
`apps/extension/dist`. Open the extension options, set the control-plane API URL (e.g.
`http://localhost:8787`) and an optional bearer token, then approve the host-access prompt.

## Security

- Use a **scoped** Cloudflare API token (Workers KV Storage edit on one account). Never the Global
  API Key. A leaked scoped token can edit KV; it cannot touch the rest of your account.
- The token lives in `.env` (or your secrets manager) and is read into the container at runtime. It
  is never committed and never logged. `.env` is gitignored; only `.env.example` is tracked.
- Bind the control plane to LAN (`127.0.0.1` by default). It has no built-in auth, so do not expose
  the port to the internet. For remote admin use a **Cloudflare Tunnel + Access** in front: zero
  open ports, identity-gated.
- Redirects never depend on the container. Even if the control plane is fully compromised and wiped,
  the worker keeps serving from KV, and rotating the token cuts off further writes.
- The extension stores its token in `chrome.storage.local` and requests host access only for the API
  origin you configure. Prefer routing through the control plane over giving the extension a CF token.
- Run `doctor` after setup to confirm the token is scoped and active.

## Roadmap

Each item is one PR. All shipped: scaffold, worker redirect, shared CF client, control-plane API,
control-plane portal, extension, doctor, docs + landing page.

1. `chore/scaffold` - pnpm monorepo, four packages, CLAUDE.md, README, MIT LICENSE, .env.example,
   ESLint/Prettier/tsconfig, CI (lint + typecheck + test).
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
