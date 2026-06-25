import { describe, expect, it } from "vitest";
import { buildShortUrl, dedupeRecent, normalizeBaseUrl, type RecentLink } from "./util.js";

describe("normalizeBaseUrl", () => {
  it("trims whitespace and trailing slashes", () => {
    expect(normalizeBaseUrl("  https://hopgo.co/// ")).toBe("https://hopgo.co");
    expect(normalizeBaseUrl("http://localhost:8787")).toBe("http://localhost:8787");
  });
});

describe("buildShortUrl", () => {
  it("joins base and slug with a single slash", () => {
    expect(buildShortUrl("https://hopgo.co/", "abc")).toBe("https://hopgo.co/abc");
  });
});

describe("dedupeRecent", () => {
  const make = (slug: string): RecentLink => ({
    slug,
    url: `https://example.com/${slug}`,
    shortUrl: `https://hopgo.co/${slug}`,
    createdAt: "2026-06-01T00:00:00.000Z",
  });

  it("prepends, removes the prior entry for the same slug, and caps length", () => {
    const list = [make("a"), make("b"), make("c")];
    const result = dedupeRecent(list, make("b"), 3);
    expect(result.map((l) => l.slug)).toEqual(["b", "a", "c"]);
  });

  it("caps the list to max", () => {
    const list = [make("a"), make("b"), make("c")];
    const result = dedupeRecent(list, make("d"), 3);
    expect(result.map((l) => l.slug)).toEqual(["d", "a", "b"]);
  });
});
