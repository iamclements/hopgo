/**
 * Slug generation and validation. Runs in both Node (control plane) and the
 * Workers runtime, so it relies only on the global Web Crypto API.
 */

/** Base62. No look-alike stripping: short links are case-sensitive on purpose. */
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const DEFAULT_SLUG_LENGTH = 7;
const MAX_SLUG_LENGTH = 128;

/** Slugs that collide with worker-reserved paths must never be issued. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set(["favicon.ico", "robots.txt"]);

/** Prefix under which the worker stores per-slug click counters in KV. */
export const CLICK_KEY_PREFIX = "clicks:";

/** KV key holding the click count for a slug. */
export function clickKey(slug: string): string {
  return `${CLICK_KEY_PREFIX}${slug}`;
}

/**
 * A custom slug is valid when it is 1..128 chars of [A-Za-z0-9_-], is not a
 * reserved path, and is not itself a click-counter key.
 */
export function isValidSlug(slug: string): boolean {
  if (slug.length === 0 || slug.length > MAX_SLUG_LENGTH) return false;
  if (RESERVED_SLUGS.has(slug)) return false;
  if (slug.startsWith(CLICK_KEY_PREFIX)) return false;
  return /^[A-Za-z0-9_-]+$/.test(slug);
}

/** Generate a random base62 slug of the given length. */
export function generateSlug(length: number = DEFAULT_SLUG_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    // Modulo bias is negligible for a 62-char alphabet at slug lengths.
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

export interface GenerateUniqueSlugOptions {
  length?: number;
  maxAttempts?: number;
}

/**
 * Generate a slug that does not already exist. `exists` is the collision check
 * (typically a KV lookup). Throws if no free slug is found within maxAttempts.
 */
export async function generateUniqueSlug(
  exists: (slug: string) => boolean | Promise<boolean>,
  options: GenerateUniqueSlugOptions = {},
): Promise<string> {
  const { length = DEFAULT_SLUG_LENGTH, maxAttempts = 5 } = options;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const slug = generateSlug(length);
    if (!(await exists(slug))) return slug;
  }
  throw new Error(`Could not generate a unique slug after ${maxAttempts} attempts`);
}
