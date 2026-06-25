import {
  CloudflareApiError,
  CloudflareKvClient,
  deleteLink,
  generateUniqueSlug,
  getClicks,
  getLink,
  isValidSlug,
  linkExists,
  listLinks,
  putLink,
  type Link,
} from "@hopgo/shared";
import { Hono } from "hono";
import { PORTAL_HTML } from "./portal.js";

export interface AppDeps {
  client: CloudflareKvClient;
  /** Tenant stamped onto every created link. "local" for the homelab build. */
  tenantId: string;
  /** Public origin where redirects are served, e.g. https://hopgo.co. */
  publicBaseUrl: string;
}

interface CreateLinkBody {
  url?: unknown;
  slug?: unknown;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Build the control-plane REST API. The Cloudflare client is injected so the app
 * is trivially testable and so the source of truth stays on Cloudflare: this
 * process holds no link state of its own and can be wiped at any time.
 */
export function createApp(deps: AppDeps) {
  const { client, tenantId, publicBaseUrl } = deps;
  const app = new Hono();

  // Surface upstream Cloudflare failures as 502 rather than a bare 500.
  app.onError((err, c) => {
    if (err instanceof CloudflareApiError) {
      return c.json({ error: "cloudflare api error", status: err.status }, 502);
    }
    console.error(err);
    return c.json({ error: "internal error" }, 500);
  });

  app.get("/health", (c) => c.json({ status: "ok" }));

  // Minimal web portal (served by the same container) and the config it reads.
  app.get("/", (c) => c.html(PORTAL_HTML));
  app.get("/api/config", (c) => c.json({ publicBaseUrl, tenantId }));

  // List links (one page). Pass ?withClicks=1 to include each link's click count.
  app.get("/api/links", async (c) => {
    const cursor = c.req.query("cursor");
    const limitRaw = c.req.query("limit");
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    const result = await listLinks(client, { cursor, limit });

    if (c.req.query("withClicks")) {
      const links = await Promise.all(
        result.links.map(async (link) => ({ ...link, clicks: await getClicks(client, link.slug) })),
      );
      return c.json({ links, cursor: result.cursor });
    }
    return c.json(result);
  });

  // Create a link with an auto-generated or custom slug.
  app.post("/api/links", async (c) => {
    const body = (await c.req.json().catch(() => null)) as CreateLinkBody | null;

    if (!body || typeof body.url !== "string" || !isValidUrl(body.url)) {
      return c.json({ error: "url must be an absolute http(s) URL" }, 400);
    }

    let slug: string;
    if (body.slug !== undefined) {
      if (typeof body.slug !== "string" || !isValidSlug(body.slug)) {
        return c.json({ error: "slug must be 1-128 chars of [A-Za-z0-9_-]" }, 400);
      }
      if (await linkExists(client, body.slug)) {
        return c.json({ error: `slug "${body.slug}" already exists` }, 409);
      }
      slug = body.slug;
    } else {
      slug = await generateUniqueSlug((candidate) => linkExists(client, candidate));
    }

    const link: Link = {
      slug,
      url: body.url,
      tenantId,
      createdAt: new Date().toISOString(),
    };
    await putLink(client, link);
    return c.json(link, 201);
  });

  // Get a single link plus its click count.
  app.get("/api/links/:slug", async (c) => {
    const slug = c.req.param("slug");
    const link = await getLink(client, slug);
    if (!link) {
      return c.json({ error: "not found" }, 404);
    }
    const clicks = await getClicks(client, slug);
    return c.json({ ...link, clicks });
  });

  // Delete a link and its click counter.
  app.delete("/api/links/:slug", async (c) => {
    const slug = c.req.param("slug");
    if (!(await linkExists(client, slug))) {
      return c.json({ error: "not found" }, 404);
    }
    await deleteLink(client, slug);
    return c.body(null, 204);
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
