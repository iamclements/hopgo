import { describe, expect, it, vi } from "vitest";
import { CloudflareKvClient } from "./cloudflare.js";
import { deleteLink, getClicks, getLink, listLinks, putLink } from "./links.js";
import type { Link } from "./types.js";

const record = {
  url: "https://example.com",
  tenantId: "local",
  createdAt: "2026-06-01T00:00:00.000Z",
};

/** Build a client whose KV operations are backed by an in-memory map. */
function fakeClient(store: Map<string, string>) {
  const client = new CloudflareKvClient({
    apiToken: "t",
    accountId: "a",
    namespaceId: "n",
  });
  vi.spyOn(client, "readValue").mockImplementation(async (key) => store.get(key) ?? null);
  vi.spyOn(client, "writeValue").mockImplementation(async (key, value) => {
    store.set(key, value);
  });
  vi.spyOn(client, "deleteValue").mockImplementation(async (key) => {
    store.delete(key);
  });
  vi.spyOn(client, "listKeys").mockImplementation(async () => ({
    keys: [...store.keys()].map((name) => ({ name })),
    listComplete: true,
  }));
  return client;
}

describe("getLink / putLink", () => {
  it("round-trips a link, storing the value without the slug", async () => {
    const store = new Map<string, string>();
    const client = fakeClient(store);
    const link: Link = { slug: "gh", ...record };

    await putLink(client, link);

    expect(JSON.parse(store.get("gh")!)).toEqual(record);
    expect(await getLink(client, "gh")).toEqual(link);
  });

  it("returns null for an unknown slug", async () => {
    expect(await getLink(fakeClient(new Map()), "missing")).toBeNull();
  });
});

describe("deleteLink", () => {
  it("removes both the link and its click counter", async () => {
    const store = new Map<string, string>([
      ["gh", JSON.stringify(record)],
      ["clicks:gh", "5"],
    ]);
    await deleteLink(fakeClient(store), "gh");
    expect(store.has("gh")).toBe(false);
    expect(store.has("clicks:gh")).toBe(false);
  });
});

describe("getClicks", () => {
  it("returns the parsed counter or zero", async () => {
    const store = new Map<string, string>([["clicks:gh", "12"]]);
    const client = fakeClient(store);
    expect(await getClicks(client, "gh")).toBe(12);
    expect(await getClicks(client, "unseen")).toBe(0);
  });
});

describe("listLinks", () => {
  it("returns link records and skips click-counter keys", async () => {
    const store = new Map<string, string>([
      ["gh", JSON.stringify(record)],
      ["clicks:gh", "5"],
      ["yt", JSON.stringify({ ...record, url: "https://youtube.com" })],
    ]);

    const { links } = await listLinks(fakeClient(store));

    expect(links.map((l) => l.slug).sort()).toEqual(["gh", "yt"]);
  });
});
