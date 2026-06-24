import { PRODUCT_NAME } from "@hopgo/shared";

/**
 * Chrome MV3 extension.
 *
 * The real "shorten current tab" flow, clipboard copy, recent links, and settings
 * (API base URL + token) land in feat/extension (PR #6), built with Vite + TS.
 * This placeholder only proves the workspace wiring.
 */
export function describeExtension(): string {
  return `${PRODUCT_NAME} extension: shorten current tab`;
}
