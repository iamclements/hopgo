/**
 * One-click setup: deploy the Hopgo redirect Worker into the user's own
 * Cloudflare account and bind it to a domain they own. Uses the OAuth access
 * token (workers_scripts:write, workers_routes:write, zone:read) as a Bearer.
 *
 * The Worker is shipped as a self-contained ES module string (no bundler) so it
 * can be uploaded via the API from anywhere, including the extension. It mirrors
 * apps/worker: GET /:slug -> 302 from KV, 404 on miss, async click counter.
 */
import { CloudflareApiError } from "./cloudflare.js";

const CF_API = "https://api.cloudflare.com/client/v4";

/** Default Worker script name created in the user's account. */
export const DEFAULT_SCRIPT_NAME = "hopgo";

/** Compatibility date the deployed Worker is pinned to. */
export const DEFAULT_COMPATIBILITY_DATE = "2026-06-01";

/** The redirect Worker uploaded to the user's account. Binding name: LINKS. */
export const REDIRECT_WORKER_SCRIPT = `export default {
  async fetch(request, env, ctx) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed\\n", { status: 405, headers: { allow: "GET, HEAD" } });
    }
    const slug = decodeURIComponent(new URL(request.url).pathname.replace(/^\\/+/, ""));
    if (slug === "") return new Response("Hopgo: this domain serves short links.\\n", { status: 200 });
    if (slug === "favicon.ico" || slug === "robots.txt") {
      return new Response("Not found\\n", { status: 404 });
    }
    const raw = await env.LINKS.get(slug);
    if (!raw) return new Response("No link found for /" + slug + "\\n", { status: 404 });
    let url = null;
    try { url = JSON.parse(raw).url; } catch (e) {}
    if (!url) return new Response("No link found for /" + slug + "\\n", { status: 404 });
    ctx.waitUntil((async () => {
      const key = "clicks:" + slug;
      const current = await env.LINKS.get(key);
      await env.LINKS.put(key, String((current ? parseInt(current, 10) || 0 : 0) + 1));
    })());
    return Response.redirect(url, 302);
  }
};
`;

interface Envelope<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: T;
}

export interface CloudflareZone {
  id: string;
  name: string;
}

function authHeader(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

/** List the zones (domains) the token can see. */
export async function listZones(fetchImpl: typeof fetch, token: string): Promise<CloudflareZone[]> {
  const res = await fetchImpl(`${CF_API}/zones?per_page=50`, { headers: authHeader(token) });
  const body = (await res.json().catch(() => null)) as Envelope<CloudflareZone[]> | null;
  if (!res.ok || !body?.success) {
    throw new CloudflareApiError("Failed to list zones", res.status, body?.errors);
  }
  return body.result;
}

export interface DeployWorkerOptions {
  accountId: string;
  namespaceId: string;
  scriptName?: string;
  compatibilityDate?: string;
  script?: string;
}

/** Upload the redirect Worker with a KV binding to the user's namespace. */
export async function deployWorker(
  fetchImpl: typeof fetch,
  token: string,
  options: DeployWorkerOptions,
): Promise<void> {
  const scriptName = options.scriptName ?? DEFAULT_SCRIPT_NAME;
  const metadata = {
    main_module: "worker.js",
    compatibility_date: options.compatibilityDate ?? DEFAULT_COMPATIBILITY_DATE,
    bindings: [{ type: "kv_namespace", name: "LINKS", namespace_id: options.namespaceId }],
  };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append(
    "worker.js",
    new Blob([options.script ?? REDIRECT_WORKER_SCRIPT], { type: "application/javascript+module" }),
    "worker.js",
  );

  const res = await fetchImpl(
    `${CF_API}/accounts/${options.accountId}/workers/scripts/${scriptName}`,
    { method: "PUT", headers: authHeader(token), body: form },
  );
  const body = (await res.json().catch(() => null)) as Envelope<unknown> | null;
  if (!res.ok || !body?.success) {
    throw new CloudflareApiError("Failed to deploy Worker", res.status, body?.errors);
  }
}

/** Bind a route (e.g. example.com/*) to the script, skipping if it already exists. */
export async function ensureRoute(
  fetchImpl: typeof fetch,
  token: string,
  zoneId: string,
  pattern: string,
  scriptName: string = DEFAULT_SCRIPT_NAME,
): Promise<void> {
  const listRes = await fetchImpl(`${CF_API}/zones/${zoneId}/workers/routes`, {
    headers: authHeader(token),
  });
  const listed = (await listRes.json().catch(() => null)) as Envelope<
    Array<{ pattern: string; script: string }>
  > | null;
  if (!listRes.ok || !listed?.success) {
    throw new CloudflareApiError("Failed to list Worker routes", listRes.status, listed?.errors);
  }
  if (listed.result.some((r) => r.pattern === pattern && r.script === scriptName)) {
    return;
  }

  const res = await fetchImpl(`${CF_API}/zones/${zoneId}/workers/routes`, {
    method: "POST",
    headers: { ...authHeader(token), "content-type": "application/json" },
    body: JSON.stringify({ pattern, script: scriptName }),
  });
  const body = (await res.json().catch(() => null)) as Envelope<unknown> | null;
  if (!res.ok || !body?.success) {
    throw new CloudflareApiError("Failed to bind Worker route", res.status, body?.errors);
  }
}

export interface ProvisionOptions {
  accountId: string;
  zoneId: string;
  /** Route pattern, e.g. "example.com/*". */
  pattern: string;
  namespaceId: string;
  scriptName?: string;
  compatibilityDate?: string;
}

/** Deploy the Worker and bind the route in one step. */
export async function provisionDomain(
  fetchImpl: typeof fetch,
  token: string,
  options: ProvisionOptions,
): Promise<void> {
  const scriptName = options.scriptName ?? DEFAULT_SCRIPT_NAME;
  await deployWorker(fetchImpl, token, {
    accountId: options.accountId,
    namespaceId: options.namespaceId,
    scriptName,
    compatibilityDate: options.compatibilityDate,
  });
  await ensureRoute(fetchImpl, token, options.zoneId, options.pattern, scriptName);
}
