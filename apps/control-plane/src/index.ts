import { DEFAULT_TENANT_ID, PRODUCT_NAME } from "@hopgo/shared";

/**
 * Control plane: the disposable Docker container (Hono REST API + web portal).
 *
 * The real API (create/list/get/delete/stats), env-driven scoped-token auth, the
 * Dockerfile, and the non-root/PUID entrypoint land in feat/control-plane-api
 * (PR #4). Source of truth is Cloudflare: this container must stay disposable.
 */
export function describeControlPlane(): string {
  return `${PRODUCT_NAME} control plane (tenant: ${DEFAULT_TENANT_ID})`;
}
