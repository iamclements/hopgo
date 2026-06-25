/**
 * Pure helpers shared by the popup, options, and API layers. No chrome or DOM
 * APIs here so they can be unit tested in plain Node.
 */

export interface RecentLink {
  slug: string;
  url: string;
  shortUrl: string;
  createdAt: string;
}

/** Strip trailing slashes and surrounding whitespace from a base URL. */
export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

/** Build the public short URL for a slug from a base origin. */
export function buildShortUrl(base: string, slug: string): string {
  return `${normalizeBaseUrl(base)}/${slug}`;
}

/** Prepend a link to the recent list, dedupe by slug, and cap the length. */
export function dedupeRecent(list: RecentLink[], link: RecentLink, max = 10): RecentLink[] {
  return [link, ...list.filter((l) => l.slug !== link.slug)].slice(0, max);
}
