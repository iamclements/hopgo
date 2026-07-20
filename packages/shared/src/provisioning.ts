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

/**
 * Version of the embedded REDIRECT_WORKER_SCRIPT. Increment this whenever
 * the script changes so the extension can detect and offer a Worker update.
 */
export const WORKER_SCRIPT_VERSION = "1";

/** The redirect Worker uploaded to the user's account. Binding name: LINKS. */
export const REDIRECT_WORKER_SCRIPT = `// hopgo-version: 1
export default {
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
  /** The account that owns the zone (present in /zones responses). */
  account?: { id: string; name?: string };
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

/** Bind a route (e.g. example.com/*) to the script.
 *  If the pattern already exists pointing at a different script, updates it in place. */
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
    Array<{ id: string; pattern: string; script: string }>
  > | null;
  if (!listRes.ok || !listed?.success) {
    throw new CloudflareApiError("Failed to list Worker routes", listRes.status, listed?.errors);
  }

  const existing = listed.result.find((r) => r.pattern === pattern);
  if (existing) {
    if (existing.script === scriptName) return; // already correct
    // Pattern exists but points at a different script — update it.
    const res = await fetchImpl(`${CF_API}/zones/${zoneId}/workers/routes/${existing.id}`, {
      method: "PUT",
      headers: { ...authHeader(token), "content-type": "application/json" },
      body: JSON.stringify({ pattern, script: scriptName }),
    });
    const body = (await res.json().catch(() => null)) as Envelope<unknown> | null;
    if (!res.ok || !body?.success) {
      throw new CloudflareApiError("Failed to update Worker route", res.status, body?.errors);
    }
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

/**
 * Ensure a proxied DNS record exists for the host, so the Worker route fires.
 * A Worker route only runs for hostnames that resolve through Cloudflare. For a
 * link-only subdomain we use a proxied AAAA to 100:: (a standard black-hole
 * address): nothing serves it directly, the Worker handles every request.
 */
export async function ensureDnsRecord(
  fetchImpl: typeof fetch,
  token: string,
  zoneId: string,
  name: string,
): Promise<void> {
  const listRes = await fetchImpl(
    `${CF_API}/zones/${zoneId}/dns_records?name=${encodeURIComponent(name)}`,
    { headers: authHeader(token) },
  );
  const listed = (await listRes.json().catch(() => null)) as Envelope<
    Array<{ id: string; proxied: boolean }>
  > | null;
  if (!listRes.ok || !listed?.success) {
    throw new CloudflareApiError("Failed to list DNS records", listRes.status, listed?.errors);
  }
  // A proxied record already routes the host through Cloudflare; leave it alone.
  if (listed.result.some((r) => r.proxied)) return;

  const res = await fetchImpl(`${CF_API}/zones/${zoneId}/dns_records`, {
    method: "POST",
    headers: { ...authHeader(token), "content-type": "application/json" },
    body: JSON.stringify({
      type: "AAAA",
      name,
      content: "100::",
      proxied: true,
      ttl: 1,
      comment: "Hopgo redirect (Worker route)",
    }),
  });
  const body = (await res.json().catch(() => null)) as Envelope<unknown> | null;
  if (!res.ok || !body?.success) {
    throw new CloudflareApiError("Failed to create DNS record", res.status, body?.errors);
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

/** List all Worker scripts in an account. */
async function listWorkerScripts(
  fetchImpl: typeof fetch,
  token: string,
  accountId: string,
): Promise<Array<{ id: string }>> {
  const res = await fetchImpl(`${CF_API}/accounts/${accountId}/workers/scripts`, {
    headers: authHeader(token),
  });
  const body = (await res.json().catch(() => null)) as Envelope<Array<{ id: string }>> | null;
  if (!res.ok || !body?.success) return [];
  return body.result;
}

/** Return the namespace_id of the LINKS KV binding for a Worker, or null if not found. */
async function getWorkerNamespaceId(
  fetchImpl: typeof fetch,
  token: string,
  accountId: string,
  scriptName: string,
): Promise<string | null> {
  const res = await fetchImpl(
    `${CF_API}/accounts/${accountId}/workers/scripts/${scriptName}/bindings`,
    { headers: authHeader(token) },
  );
  const body = (await res.json().catch(() => null)) as Envelope<
    Array<{ type: string; name: string; namespace_id?: string }>
  > | null;
  if (!res.ok || !body?.success) return null;
  return (
    body.result.find((b) => b.type === "kv_namespace" && b.name === "LINKS")?.namespace_id ?? null
  );
}

export interface DiscoveredDomain {
  domain: string;
  namespaceId: string;
  scriptName: string;
}

/**
 * Scan the account for Hopgo Workers (named "hopgo" or "hopgo-*") and return
 * the domain + namespace for each. Used to auto-populate the domain list after
 * sign-in. Returns an empty array on any API error so sign-in is never blocked.
 */
export async function discoverDomains(
  fetchImpl: typeof fetch,
  token: string,
  accountId: string,
): Promise<DiscoveredDomain[]> {
  try {
    const scripts = await listWorkerScripts(fetchImpl, token, accountId);
    const hopgoScripts = scripts.filter((s) => s.id === "hopgo" || s.id.startsWith("hopgo-"));
    if (hopgoScripts.length === 0) return [];

    // Resolve namespace IDs for all Hopgo Workers in parallel.
    const nsEntries = await Promise.all(
      hopgoScripts.map(async (s) => {
        const nsId = await getWorkerNamespaceId(fetchImpl, token, accountId, s.id);
        return { scriptName: s.id, namespaceId: nsId };
      }),
    );
    const scriptNs = new Map(
      nsEntries
        .filter((e): e is { scriptName: string; namespaceId: string } => e.namespaceId !== null)
        .map((e) => [e.scriptName, e.namespaceId]),
    );

    // Check every zone's routes for routes that point at a Hopgo Worker.
    const zones = await listZones(fetchImpl, token);
    const results: DiscoveredDomain[] = [];

    await Promise.all(
      zones.map(async (zone) => {
        const res = await fetchImpl(`${CF_API}/zones/${zone.id}/workers/routes`, {
          headers: authHeader(token),
        });
        const body = (await res.json().catch(() => null)) as Envelope<
          Array<{ pattern: string; script: string }>
        > | null;
        if (!res.ok || !body?.success) return;
        for (const route of body.result) {
          const nsId = scriptNs.get(route.script);
          if (!nsId) continue;
          // Extract hostname from pattern like "go.example.com/*" — skip wildcard hosts.
          const host = route.pattern.replace(/\/\*$/, "");
          if (host.includes("*")) continue;
          results.push({ domain: `https://${host}`, namespaceId: nsId, scriptName: route.script });
        }
      }),
    );

    return results;
  } catch {
    return [];
  }
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

/**
 * Return the workers.dev subdomain for the account (the part before .workers.dev).
 * Cloudflare creates one automatically on first script deploy; may be null for
 * brand-new accounts that have never deployed a script.
 */
export async function getWorkersDotDevSubdomain(
  fetchImpl: typeof fetch,
  token: string,
  accountId: string,
): Promise<string | null> {
  const res = await fetchImpl(`${CF_API}/accounts/${accountId}/workers/subdomain`, {
    headers: authHeader(token),
  });
  const body = (await res.json().catch(() => null)) as Envelope<{ subdomain: string } | null> | null;
  if (!res.ok || !body?.success) return null;
  return body.result?.subdomain ?? null;
}

/** Enable the workers.dev route for a deployed script. */
export async function enableWorkersDotDevRoute(
  fetchImpl: typeof fetch,
  token: string,
  accountId: string,
  scriptName: string,
): Promise<void> {
  const res = await fetchImpl(
    `${CF_API}/accounts/${accountId}/workers/scripts/${scriptName}/subdomain`,
    {
      method: "POST",
      headers: { ...authHeader(token), "content-type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    },
  );
  const body = (await res.json().catch(() => null)) as Envelope<unknown> | null;
  if (!res.ok || !body?.success) {
    throw new CloudflareApiError(
      "Failed to enable workers.dev route",
      res.status,
      body?.errors,
    );
  }
}

export interface ProvisionWorkersDotDevOptions {
  accountId: string;
  namespaceId: string;
  scriptName?: string;
  compatibilityDate?: string;
}

/**
 * Deploy the Worker and enable its workers.dev route, then return the resulting
 * URL (https://<scriptName>.<subdomain>.workers.dev). No zone or DNS needed.
 * Throws if the account subdomain is unavailable after deployment.
 */
export async function provisionWorkersDotDevDomain(
  fetchImpl: typeof fetch,
  token: string,
  options: ProvisionWorkersDotDevOptions,
): Promise<string> {
  const scriptName = options.scriptName ?? DEFAULT_SCRIPT_NAME;
  await deployWorker(fetchImpl, token, {
    accountId: options.accountId,
    namespaceId: options.namespaceId,
    scriptName,
    compatibilityDate: options.compatibilityDate,
  });
  await enableWorkersDotDevRoute(fetchImpl, token, options.accountId, scriptName);
  const subdomain = await getWorkersDotDevSubdomain(fetchImpl, token, options.accountId);
  if (!subdomain) {
    throw new Error(
      "Cloudflare did not return a workers.dev subdomain. " +
        "Try again, or contact Cloudflare support if this persists.",
    );
  }
  return `https://${scriptName}.${subdomain}.workers.dev`;
}
