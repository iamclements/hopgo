# Chrome Web Store listing copy (draft)

Set these directly on the Chrome Web Store Developer Dashboard — not in the repo.

## Title

Hopgo — URL Shortener on Your Cloudflare

(32-char limit; current title "Hopgo" could stay as-is if you'd rather keep it short and rely on the description.)

## Short description (132 char max)

Branded URL shortener that runs entirely on your own Cloudflare account. No server, no third-party database.

(109 chars)

## Category

Productivity (Chrome Web Store's closest fit for developer/link-management tools; "Developer Tools" also fits if you want to signal it's for a technical audience).

## Detailed description

Hopgo shortens links from any tab and serves the redirects from your own Cloudflare account, not ours.

Most URL shorteners ask you to trust their server with your links, or ask you to run and patch your own. Hopgo does neither: the Chrome extension talks to the Cloudflare API directly, and the redirect Worker runs in your Cloudflare account, using your KV storage.

How it works:

- Sign in with Cloudflare using OAuth (PKCE) — no password stored, no client secret
- Pick a domain you already manage on Cloudflare, or use the free workers.dev subdomain — no domain required
- Click the extension on any tab, edit the slug if you want, hit Shorten
- Manage every link — search, sort, bulk delete, set expiry — from the built-in dashboard

Why it's different:

- Nothing to host: no server, no container, no VPS to patch
- You own everything: links live in your Cloudflare KV, in your account
- Free: MIT-licensed, and Cloudflare's free tier covers normal usage
- Open source: github.com/iamclements/hopgo

If Hopgo shuts down tomorrow, your links keep working — the Worker has zero dependency on our infrastructure.

## Notes

- Screenshots/promo tiles regenerated this session from apps/extension/store-assets/generate.mjs (unchanged visual design, just refreshed the committed PNGs to match the current SVG source).
- Double check the store's live listing copy against this draft before pasting over it — I don't have visibility into what's currently published there.
