/**
 * Core Hopgo domain types. Tenant-aware from day one: every link carries a
 * tenantId even though the homelab build only ever uses DEFAULT_TENANT_ID.
 * This is the seam that lets a hosted multi-tenant build land later without a
 * schema rewrite. Do not add SaaS/billing fields yet.
 */

export interface Tenant {
  id: string;
  /** Human label, optional. The homelab tenant has none. */
  name?: string;
}

/**
 * The value stored in KV under a slug key. The worker reads this shape to serve
 * redirects; the control plane writes it via the Cloudflare API.
 */
export interface LinkRecord {
  url: string;
  tenantId: string;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** Unix timestamp (seconds) after which the link expires. KV handles deletion automatically. */
  expiresAt?: number;
}

/** A link plus its slug, as returned by the control-plane API. */
export interface Link extends LinkRecord {
  slug: string;
}
