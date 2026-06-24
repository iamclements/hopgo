import { PRODUCT_NAME } from "@hopgo/shared";

/**
 * Cloudflare Worker: the data plane.
 *
 * The real KV-backed `GET /:slug` -> 302 redirect, 404 fallback, and async click
 * counter land in feat/worker-redirect (PR #2), along with Wrangler config and
 * Miniflare tests. This placeholder only proves the workspace wiring.
 */
export function describeDataPlane(): string {
  return `${PRODUCT_NAME} worker: edge redirect + click counter`;
}
