/** Talks to the Hopgo control-plane API to create links. */
import type { Link } from "@hopgo/shared";
import type { Settings } from "./storage.js";
import { buildShortUrl, normalizeBaseUrl } from "./util.js";

export interface ShortenResult {
  link: Link;
  shortUrl: string;
}

function authHeaders(settings: Settings): Record<string, string> {
  return settings.token ? { authorization: `Bearer ${settings.token}` } : {};
}

/** Create a short link for a URL and resolve its public short form. */
export async function shorten(settings: Settings, url: string): Promise<ShortenResult> {
  const base = normalizeBaseUrl(settings.apiBaseUrl);
  if (!base) {
    throw new Error("Set the API base URL in the extension options first.");
  }

  const res = await fetch(`${base}/api/links`, {
    method: "POST",
    headers: { ...authHeaders(settings), "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }

  const link = (await res.json()) as Link;

  // Prefer the worker's public origin for the copyable URL; fall back to the API base.
  const cfg = (await fetch(`${base}/api/config`)
    .then((r) => r.json())
    .catch(() => ({}))) as { publicBaseUrl?: string };

  return { link, shortUrl: buildShortUrl(cfg.publicBaseUrl || base, link.slug) };
}
