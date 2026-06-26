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

/** Per-domain KV namespace IDs, keyed by the full domain URL (e.g. https://go.example.com). */
export async function getDomainNamespaces(): Promise<Record<string, string>> {
  const { domainNamespaces } = await chrome.storage.local.get("domainNamespaces");
  return (domainNamespaces as Record<string, string>) ?? {};
}

export async function setDomainNamespace(domain: string, namespaceId: string): Promise<void> {
  const existing = await getDomainNamespaces();
  await chrome.storage.local.set({ domainNamespaces: { ...existing, [domain]: namespaceId } });
}

/** All saved short-link domains, in the order they were added. */
export async function getDomains(): Promise<string[]> {
  const { domains } = await chrome.storage.local.get("domains");
  if (Array.isArray(domains) && domains.length > 0) return domains as string[];
  // Migrate legacy single-domain storage key.
  const { shortDomain } = await chrome.storage.local.get("shortDomain");
  if (shortDomain) {
    const migrated = [shortDomain as string];
    await chrome.storage.local.set({ domains: migrated, activeDomain: shortDomain });
    return migrated;
  }
  return [];
}

export async function setDomains(domains: string[]): Promise<void> {
  await chrome.storage.local.set({ domains });
}

/** The currently selected short-link domain. Falls back to the first saved domain. */
export async function getActiveDomain(): Promise<string> {
  const [{ activeDomain }, saved] = await Promise.all([
    chrome.storage.local.get("activeDomain"),
    getDomains(),
  ]);
  if (activeDomain && saved.includes(activeDomain as string)) return activeDomain as string;
  return saved[0] ?? "";
}

export async function setActiveDomain(domain: string): Promise<void> {
  await chrome.storage.local.set({ activeDomain: domain });
}

/** @deprecated Use getActiveDomain / setDomains instead. */
export async function getShortDomain(): Promise<string> {
  return getActiveDomain();
}

/** @deprecated Use setDomains / setActiveDomain instead. */
export async function setShortDomain(domain: string): Promise<void> {
  const existing = await getDomains();
  if (!existing.includes(domain)) {
    await setDomains([...existing, domain]);
  }
  await setActiveDomain(domain);
}
