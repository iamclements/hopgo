/**
 * Hopgo data plane: the Cloudflare Worker that serves redirects from the edge.
 *
 * `GET /:slug` looks the slug up in KV and 302s to the target. Unknown slugs
 * return a 404, or redirect to the URL stored under the reserved key
 * `__404_redirect__` if set. Click counts are bumped after the response via
 * `ctx.waitUntil`, so counting never delays the redirect.
 */

import { LANDING_HTML } from "./landing.js";

/** Shape of a link record stored in KV under its slug. Kept tenant-aware from day one. */
export interface StoredLink {
  url: string;
  tenantId: string;
  createdAt: string;
}

/** KV key holding the click count for a slug. */
function clickKey(slug: string): string {
  return `clicks:${slug}`;
}

/** Reserved top-level paths that are never treated as slugs. */
const RESERVED_PATHS = new Set(["", "favicon.ico", "robots.txt", "__404_redirect__"]);

function landingResponse(): Response {
  return new Response(LANDING_HTML, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function notFoundResponse(slug: string): Response {
  return new Response(`No link found for /${slug}\n`, {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

/** Read-modify-write the click counter. Runs in `waitUntil`, off the response path. */
async function recordClick(env: Env, slug: string): Promise<void> {
  const key = clickKey(slug);
  const current = await env.LINKS.get(key);
  const next = (current ? Number.parseInt(current, 10) || 0 : 0) + 1;
  await env.LINKS.put(key, String(next));
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed\n", {
        status: 405,
        headers: { allow: "GET, HEAD" },
      });
    }

    const url = new URL(request.url);
    const slug = decodeURIComponent(url.pathname.replace(/^\/+/, ""));

    if (RESERVED_PATHS.has(slug)) {
      return slug === "" ? landingResponse() : notFoundResponse(slug);
    }

    const link = await env.LINKS.get<StoredLink>(slug, "json");
    if (!link) {
      const redirect404 = await env.LINKS.get("__404_redirect__");
      if (redirect404) return Response.redirect(redirect404, 302);
      return notFoundResponse(slug);
    }

    ctx.waitUntil(recordClick(env, slug));
    return Response.redirect(link.url, 302);
  },
} satisfies ExportedHandler<Env>;
