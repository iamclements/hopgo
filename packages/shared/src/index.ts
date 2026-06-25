/**
 * Shared types and utilities for Hopgo: domain types, the Cloudflare KV client,
 * link helpers, and slug generation. Used by the control plane, the extension,
 * and the doctor preflight. The worker reads KV via its binding, not this client.
 */

/** Default tenant for the single-tenant homelab build. */
export const DEFAULT_TENANT_ID = "local";

/** Marketing/runtime name. */
export const PRODUCT_NAME = "Hopgo";

export type { Tenant, Link, LinkRecord } from "./types.js";
export {
  CloudflareKvClient,
  CloudflareApiError,
  type CloudflareKvConfig,
  type KvKey,
  type ListKeysOptions,
  type ListKeysResult,
} from "./cloudflare.js";
export {
  getLink,
  putLink,
  deleteLink,
  linkExists,
  getClicks,
  listLinks,
  type ListLinksResult,
} from "./links.js";
export {
  generateSlug,
  generateUniqueSlug,
  isValidSlug,
  clickKey,
  CLICK_KEY_PREFIX,
  RESERVED_SLUGS,
  type GenerateUniqueSlugOptions,
} from "./slug.js";
