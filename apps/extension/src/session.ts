/**
 * Ties OAuth, storage, and the Cloudflare KV client together for the popup.
 * A "connected" session has a non-expired access token plus the discovered
 * account and namespace ids.
 */
import { CloudflareKvClient, discoverAccountId, ensureNamespace, listZones } from "@hopgo/shared";
import { cfFetch } from "./cf-fetch.js";
import { signInWithCloudflare } from "./cf-oauth.js";
import { clearConnection, getConnection, setConnection, type Connection } from "./storage.js";

/** Treat tokens within this window of expiry as already expired. */
const EXPIRY_SKEW_MS = 60_000;

function isExpired(connection: Connection): boolean {
  return Date.now() >= connection.expiresAt - EXPIRY_SKEW_MS;
}

/** The current connection, or null if absent or expired (re-sign-in needed). */
export async function currentConnection(): Promise<Connection | null> {
  const connection = await getConnection();
  if (!connection || isExpired(connection)) return null;
  return connection;
}

/** Run the OAuth flow, discover account + namespace, and persist the connection. */
async function resolveAccountId(token: string): Promise<string> {
  // Prefer /accounts; fall back to the owning account of the first zone, since the
  // SPA scope set (no account-read) may not allow listing accounts directly.
  try {
    return await discoverAccountId(cfFetch, token);
  } catch {
    const zones = await listZones(cfFetch, token);
    const accountId = zones[0]?.account?.id;
    if (!accountId) {
      throw new Error(
        "Could not determine your Cloudflare account. Add a domain to Cloudflare first.",
      );
    }
    return accountId;
  }
}

export async function connect(): Promise<Connection> {
  const tokens = await signInWithCloudflare();
  const accountId = await resolveAccountId(tokens.accessToken);
  const namespaceId = await ensureNamespace(cfFetch, tokens.accessToken, accountId);
  const connection: Connection = {
    accessToken: tokens.accessToken,
    expiresAt: tokens.expiresAt,
    accountId,
    namespaceId,
  };
  await setConnection(connection);
  return connection;
}

export async function disconnect(): Promise<void> {
  await clearConnection();
}

/** A KV client bound to the connection's account and access token.
 *  Pass namespaceId to override the connection's default (for per-domain namespaces). */
export function clientFor(connection: Connection, namespaceId?: string): CloudflareKvClient {
  return new CloudflareKvClient({
    apiToken: connection.accessToken,
    accountId: connection.accountId,
    namespaceId: namespaceId ?? connection.namespaceId,
    fetch: cfFetch,
  });
}
