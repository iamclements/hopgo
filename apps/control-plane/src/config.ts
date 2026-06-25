import { CloudflareKvClient, DEFAULT_TENANT_ID } from "@hopgo/shared";

/**
 * Runtime configuration for the control plane, read from env. The scoped
 * Cloudflare token never leaves this layer: it is read here and handed to the
 * KV client. Nothing downstream sees the raw token.
 */
export interface AppConfig {
  client: CloudflareKvClient;
  tenantId: string;
  host: string;
  port: number;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  const client = new CloudflareKvClient({
    apiToken: required("CF_API_TOKEN"),
    accountId: required("CF_ACCOUNT_ID"),
    namespaceId: required("CF_KV_NAMESPACE_ID"),
  });

  return {
    client,
    tenantId: process.env.HOPGO_TENANT_ID || DEFAULT_TENANT_ID,
    host: process.env.HOST || "127.0.0.1",
    port: Number.parseInt(process.env.PORT || "8787", 10),
  };
}
