import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

/**
 * Control plane entrypoint: the disposable Docker container. It serves the REST
 * API that CRUDs links in Cloudflare KV. It holds no state; wiping and
 * redeploying it loses zero links. Bind to LAN by default; for remote admin put
 * a Cloudflare Tunnel + Access in front rather than opening a port.
 */
const config = loadConfig();
const app = createApp({ client: config.client, tenantId: config.tenantId });

serve({ fetch: app.fetch, hostname: config.host, port: config.port }, (info) => {
  console.log(`Hopgo control plane listening on http://${config.host}:${info.port}`);
});
