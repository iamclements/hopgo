/** Persistence via chrome.storage.local: the Cloudflare connection, the user's
 * short-link domain, and a cached copy of the link list for instant popup loads. */
import type { Link } from "@hopgo/shared";

export interface Connection {
  accessToken: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
  accountId: string;
  namespaceId: string;
}

export async function getConnection(): Promise<Connection | null> {
  const { connection } = await chrome.storage.local.get("connection");
  return (connection as Connection) ?? null;
}

export async function setConnection(connection: Connection): Promise<void> {
  await chrome.storage.local.set({ connection });
}

export async function clearConnection(): Promise<void> {
  await chrome.storage.local.remove(["connection", "linksCache"]);
}

/** Cached link list, shown instantly on open while a fresh copy loads. */
export async function getCachedLinks(): Promise<Link[]> {
  const { linksCache } = await chrome.storage.local.get("linksCache");
  return (linksCache as Link[]) ?? [];
}

export async function setCachedLinks(links: Link[]): Promise<void> {
  await chrome.storage.local.set({ linksCache: links });
}

/** The origin where the user's redirects are served, e.g. https://go.example.com. */
export async function getShortDomain(): Promise<string> {
  const { shortDomain } = await chrome.storage.local.get("shortDomain");
  return (shortDomain as string) ?? "";
}

export async function setShortDomain(shortDomain: string): Promise<void> {
  await chrome.storage.local.set({ shortDomain });
}
