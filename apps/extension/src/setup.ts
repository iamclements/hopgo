/**
 * One-click domain setup: list the user's Cloudflare zones and deploy the Hopgo
 * redirect Worker bound to the connection's KV namespace, then return the short
 * domain. Requires an active connection (sign in via the popup first).
 */
import {
  ensureDnsRecord,
  ensureNamespace,
  listZones,
  provisionDomain,
  type CloudflareZone,
} from "@hopgo/shared";
import { cfFetch } from "./cf-fetch.js";
import { currentConnection } from "./session.js";
import { setDomainNamespace } from "./storage.js";

export async function loadZones(): Promise<CloudflareZone[]> {
  const connection = await currentConnection();
  if (!connection) {
    throw new Error("Sign in with Cloudflare first (open the popup).");
  }
  return listZones(cfFetch, connection.accessToken);
}

export interface ProvisionResult {
  shortDomain: string;
  host: string;
  /** Whether the DNS record was created automatically or needs manual creation. */
  dns: "created" | "manual";
}

/**
 * Deploy the Worker, bind the route, and ensure DNS for `<subdomain>.<zone>` (or
 * the apex if subdomain is blank). DNS creation is best-effort: if the token lacks
 * DNS-write, the caller is told to add the record manually.
 */
export async function provisionZone(
  zone: CloudflareZone,
  subdomain: string,
): Promise<ProvisionResult> {
  const connection = await currentConnection();
  if (!connection) {
    throw new Error("Sign in with Cloudflare first (open the popup).");
  }

  const host = subdomain ? `${subdomain}.${zone.name}` : zone.name;
  // Each domain gets its own KV namespace and Worker script so link pools are isolated.
  const safeHost = host.replace(/[^a-z0-9]/gi, "-");
  const namespaceId = await ensureNamespace(
    cfFetch,
    connection.accessToken,
    connection.accountId,
    `hopgo-links-${safeHost}`,
  );
  const scriptName = `hopgo-${safeHost}`;
  await provisionDomain(cfFetch, connection.accessToken, {
    accountId: connection.accountId,
    zoneId: zone.id,
    pattern: `${host}/*`,
    namespaceId,
    scriptName,
  });
  await setDomainNamespace(`https://${host}`, namespaceId);

  let dns: ProvisionResult["dns"] = "created";
  try {
    await ensureDnsRecord(cfFetch, connection.accessToken, zone.id, host);
  } catch {
    dns = "manual";
  }

  return { shortDomain: `https://${host}`, host, dns };
}
