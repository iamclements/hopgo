/**
 * Shared types and utilities for Hopgo.
 *
 * The real Cloudflare API client, Link/Tenant types, and slug helpers land in
 * feat/shared-cf-client (PR #3). This module currently holds the tenant seam so
 * the rest of the scaffold is tenant-aware from day one. Keep every link record
 * stamped with a tenantId, even though the homelab build is single-tenant.
 */

/** Default tenant for the single-tenant homelab build. */
export const DEFAULT_TENANT_ID = "local";

/** Marketing/runtime name. */
export const PRODUCT_NAME = "Hopgo";
