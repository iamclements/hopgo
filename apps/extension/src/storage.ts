/** Persistence via chrome.storage.local: the Cloudflare connection, the user's
 * short-link domain, and recent links. */
import { dedupeRecent, type RecentLink } from "./util.js";

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
  await chrome.storage.local.remove("connection");
}

/** The origin where the user's redirects are served, e.g. https://go.example.com. */
export async function getShortDomain(): Promise<string> {
  const { shortDomain } = await chrome.storage.local.get("shortDomain");
  return (shortDomain as string) ?? "";
}

export async function setShortDomain(shortDomain: string): Promise<void> {
  await chrome.storage.local.set({ shortDomain });
}

export async function getRecent(): Promise<RecentLink[]> {
  const { recent } = await chrome.storage.local.get("recent");
  return (recent as RecentLink[]) ?? [];
}

export async function addRecent(link: RecentLink): Promise<RecentLink[]> {
  const next = dedupeRecent(await getRecent(), link);
  await chrome.storage.local.set({ recent: next });
  return next;
}
