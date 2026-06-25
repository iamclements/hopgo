/**
 * Cloudflare account + KV namespace discovery, so onboarding is zero-config: the
 * caller has just an OAuth access token, and we resolve which account to use and
 * ensure the Hopgo KV namespace exists. Uses the token as a Bearer against the
 * Cloudflare API (account:read + workers_kv:write scopes).
 */
import { CloudflareApiError } from "./cloudflare.js";

const CF_API = "https://api.cloudflare.com/client/v4";

/** Default KV namespace title created/used for Hopgo links. */
export const DEFAULT_NAMESPACE_TITLE = "hopgo-links";

interface Envelope<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: T;
}

async function cfGet<T>(fetchImpl: typeof fetch, token: string, path: string): Promise<T> {
  const res = await fetchImpl(`${CF_API}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !body?.success) {
    throw new CloudflareApiError(`GET ${path} failed`, res.status, body?.errors);
  }
  return body.result;
}

export interface CloudflareAccount {
  id: string;
  name: string;
}

/** List the accounts the token can see. */
export async function listAccounts(
  fetchImpl: typeof fetch,
  token: string,
): Promise<CloudflareAccount[]> {
  return cfGet<CloudflareAccount[]>(fetchImpl, token, "/accounts?per_page=50");
}

/** Return the first accessible account id. Throws if there are none. */
export async function discoverAccountId(fetchImpl: typeof fetch, token: string): Promise<string> {
  const accounts = await listAccounts(fetchImpl, token);
  const account = accounts[0];
  if (!account) {
    throw new Error("No Cloudflare account is accessible with this authorization.");
  }
  return account.id;
}

/** Find the Hopgo KV namespace by title, creating it if absent. Returns its id. */
export async function ensureNamespace(
  fetchImpl: typeof fetch,
  token: string,
  accountId: string,
  title: string = DEFAULT_NAMESPACE_TITLE,
): Promise<string> {
  const existing = await cfGet<Array<{ id: string; title: string }>>(
    fetchImpl,
    token,
    `/accounts/${accountId}/storage/kv/namespaces?per_page=100`,
  );
  const match = existing.find((ns) => ns.title === title);
  if (match) return match.id;

  const res = await fetchImpl(`${CF_API}/accounts/${accountId}/storage/kv/namespaces`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ title }),
  });
  const body = (await res.json().catch(() => null)) as Envelope<{ id: string }> | null;
  if (!res.ok || !body?.success) {
    throw new CloudflareApiError("Failed to create KV namespace", res.status, body?.errors);
  }
  return body.result.id;
}
