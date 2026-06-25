/**
 * One-click domain setup: list the user's Cloudflare zones and deploy the Hopgo
 * redirect Worker bound to the connection's KV namespace, then return the short
 * domain. Requires an active connection (sign in via the popup first).
 */
import { listZones, provisionDomain, type CloudflareZone } from "@hopgo/shared";
import { currentConnection } from "./session.js";

export async function loadZones(): Promise<CloudflareZone[]> {
  const connection = await currentConnection();
  if (!connection) {
    throw new Error("Sign in with Cloudflare first (open the popup).");
  }
  return listZones(fetch, connection.accessToken);
}

/** Deploy the Worker + bind the apex route for the zone. Returns the short domain. */
export async function provisionZone(zone: CloudflareZone): Promise<string> {
  const connection = await currentConnection();
  if (!connection) {
    throw new Error("Sign in with Cloudflare first (open the popup).");
  }
  await provisionDomain(fetch, connection.accessToken, {
    accountId: connection.accountId,
    zoneId: zone.id,
    pattern: `${zone.name}/*`,
    namespaceId: connection.namespaceId,
  });
  return `https://${zone.name}`;
}
