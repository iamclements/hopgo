import { describe, expect, it, vi } from "vitest";
import { clickKey, generateSlug, generateUniqueSlug, isValidSlug, RESERVED_SLUGS } from "./slug.js";

describe("generateSlug", () => {
  it("produces a slug of the requested length from the base62 alphabet", () => {
    const slug = generateSlug(10);
    expect(slug).toHaveLength(10);
    expect(slug).toMatch(/^[0-9A-Za-z]+$/);
  });

  it("defaults to length 7", () => {
    expect(generateSlug()).toHaveLength(7);
  });
});

describe("isValidSlug", () => {
  it("accepts url-safe slugs", () => {
    expect(isValidSlug("my-link_2")).toBe(true);
  });

  it("rejects empty, oversized, reserved, and click-key slugs", () => {
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("a".repeat(129))).toBe(false);
    expect(isValidSlug("favicon.ico")).toBe(false);
    expect(isValidSlug("clicks:abc")).toBe(false);
    expect(isValidSlug("has space")).toBe(false);
  });

  it("keeps reserved slugs in sync with the click prefix", () => {
    expect(RESERVED_SLUGS.has("favicon.ico")).toBe(true);
  });
});

describe("generateUniqueSlug", () => {
  it("retries until the collision check passes", async () => {
    const taken = new Set<string>();
    const exists = vi
      .fn<(s: string) => boolean>()
      .mockImplementationOnce((s) => {
        taken.add(s);
        return true;
      })
      .mockReturnValue(false);

    const slug = await generateUniqueSlug(exists);
    expect(exists).toHaveBeenCalledTimes(2);
    expect(taken.has(slug)).toBe(false);
  });

  it("throws after exhausting attempts", async () => {
    await expect(generateUniqueSlug(() => true, { maxAttempts: 3 })).rejects.toThrow(
      "after 3 attempts",
    );
  });
});

describe("clickKey", () => {
  it("namespaces the counter under the clicks prefix", () => {
    expect(clickKey("abc")).toBe("clicks:abc");
  });
});
