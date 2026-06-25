/**
 * Link-typed helpers layered over the raw KV client. These are what the control
 * plane calls: they serialize LinkRecord to/from KV and read click counters,
 * keeping the slug<->key mapping in one place.
 */

import { CloudflareKvClient } from "./cloudflare.js";
import { CLICK_KEY_PREFIX, clickKey } from "./slug.js";
import type { Link, LinkRecord } from "./types.js";

/** Read a single link by slug. Returns null when the slug is unknown. */
export async function getLink(client: CloudflareKvClient, slug: string): Promise<Link | null> {
  const raw = await client.readValue(slug);
  if (raw === null) return null;
  const record = JSON.parse(raw) as LinkRecord;
  return { slug, ...record };
}

/** True when a slug is already taken. Use as the collision check for slug generation. */
export async function linkExists(client: CloudflareKvClient, slug: string): Promise<boolean> {
  return (await client.readValue(slug)) !== null;
}

/** Create or overwrite a link. The slug is the KV key; the rest is the value. */
export async function putLink(client: CloudflareKvClient, link: Link): Promise<void> {
  const { slug, ...record } = link;
  await client.writeValue(slug, JSON.stringify(record));
}

/** Delete a link and its click counter. */
export async function deleteLink(client: CloudflareKvClient, slug: string): Promise<void> {
  await client.deleteValue(slug);
  await client.deleteValue(clickKey(slug));
}

/** Read the click count for a slug. Zero when never clicked. */
export async function getClicks(client: CloudflareKvClient, slug: string): Promise<number> {
  const raw = await client.readValue(clickKey(slug));
  if (raw === null) return 0;
  return Number.parseInt(raw, 10) || 0;
}

export interface ListLinksResult {
  links: Link[];
  cursor?: string;
}

/**
 * List links (one page), skipping click-counter keys. This issues one read per
 * slug because KV list returns keys only; fine for homelab volumes.
 */
export async function listLinks(
  client: CloudflareKvClient,
  options: { limit?: number; cursor?: string } = {},
): Promise<ListLinksResult> {
  const page = await client.listKeys({ limit: options.limit, cursor: options.cursor });
  const slugs = page.keys.map((k) => k.name).filter((name) => !name.startsWith(CLICK_KEY_PREFIX));

  const links: Link[] = [];
  for (const slug of slugs) {
    const link = await getLink(client, slug);
    if (link) links.push(link);
  }

  return { links, cursor: page.cursor };
}
