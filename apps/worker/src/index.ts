/**
 * Hopgo data plane: the Cloudflare Worker that serves redirects from the edge.
 *
 * This is the resilient half of Hopgo. It depends only on Cloudflare KV, never on
 * the control-plane container. `GET /:slug` looks the slug up in KV and 302s to the
 * target; an unknown slug returns a branded 404. Click counts are bumped after the
 * response is sent via `ctx.waitUntil`, so counting never delays the redirect.
 */

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
const RESERVED_PATHS = new Set(["", "favicon.ico", "robots.txt"]);

function landingResponse(): Response {
  return new Response("Hopgo: this domain serves short links. Unknown or missing slug.\n", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
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
      return notFoundResponse(slug);
    }

    ctx.waitUntil(recordClick(env, slug));
    return Response.redirect(link.url, 302);
  },
} satisfies ExportedHandler<Env>;
