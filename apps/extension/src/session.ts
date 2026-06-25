/**
 * Ties OAuth, storage, and the Cloudflare KV client together for the popup.
 * A "connected" session has a non-expired access token plus the discovered
 * account and namespace ids.
 */
import { CloudflareKvClient, discoverAccountId, ensureNamespace } from "@hopgo/shared";
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
export async function connect(): Promise<Connection> {
  const tokens = await signInWithCloudflare();
  const accountId = await discoverAccountId(fetch, tokens.accessToken);
  const namespaceId = await ensureNamespace(fetch, tokens.accessToken, accountId);
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

/** A KV client bound to the connection's account, namespace, and access token. */
export function clientFor(connection: Connection): CloudflareKvClient {
  return new CloudflareKvClient({
    apiToken: connection.accessToken,
    accountId: connection.accountId,
    namespaceId: connection.namespaceId,
  });
}
