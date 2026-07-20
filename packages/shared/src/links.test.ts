import { describe, expect, it, vi } from "vitest";
import { CloudflareKvClient } from "./cloudflare.js";
import { deleteLink, getClicks, getLink, listLinks, putLink } from "./links.js";
import type { Link } from "./types.js";

const record = {
  url: "https://example.com",
  tenantId: "local",
  createdAt: "2026-06-01T00:00:00.000Z",
};

interface FakeEntry {
  value: string;
  expiration?: number;
}

/** Build a client whose KV operations are backed by an in-memory map. */
function fakeClient(store: Map<string, FakeEntry>) {
  const client = new CloudflareKvClient({
    apiToken: "t",
    accountId: "a",
    namespaceId: "n",
  });
  vi.spyOn(client, "readValue").mockImplementation(async (key) => store.get(key)?.value ?? null);
  vi.spyOn(client, "writeValue").mockImplementation(async (key, value, opts) => {
    store.set(key, { value, expiration: opts?.expiration });
  });
  vi.spyOn(client, "deleteValue").mockImplementation(async (key) => {
    store.delete(key);
  });
  vi.spyOn(client, "listKeys").mockImplementation(async () => ({
    keys: [...store.entries()].map(([name, entry]) => ({ name, expiration: entry.expiration })),
    listComplete: true,
  }));
  return client;
}

function entry(value: string, expiration?: number): FakeEntry {
  return { value, expiration };
}

describe("getLink / putLink", () => {
  it("round-trips a link, storing the value without the slug", async () => {
    const store = new Map<string, FakeEntry>();
    const client = fakeClient(store);
    const link: Link = { slug: "gh", ...record };

    await putLink(client, link);

    expect(JSON.parse(store.get("gh")!.value)).toEqual(record);
    expect(await getLink(client, "gh")).toEqual(link);
  });

  it("passes expiration to writeValue when expiresAt is set", async () => {
    const store = new Map<string, FakeEntry>();
    const client = fakeClient(store);
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const link: Link = { slug: "tmp", ...record, expiresAt: exp };

    await putLink(client, link);

    expect(store.get("tmp")!.expiration).toBe(exp);
  });

  it("does not pass expiration when expiresAt is absent", async () => {
    const store = new Map<string, FakeEntry>();
    const client = fakeClient(store);
    await putLink(client, { slug: "perm", ...record });
    expect(store.get("perm")!.expiration).toBeUndefined();
  });

  it("returns null for an unknown slug", async () => {
    expect(await getLink(fakeClient(new Map()), "missing")).toBeNull();
  });
});

describe("deleteLink", () => {
  it("removes both the link and its click counter", async () => {
    const store = new Map<string, FakeEntry>([
      ["gh", entry(JSON.stringify(record))],
      ["clicks:gh", entry("5")],
    ]);
    await deleteLink(fakeClient(store), "gh");
    expect(store.has("gh")).toBe(false);
    expect(store.has("clicks:gh")).toBe(false);
  });
});

describe("getClicks", () => {
  it("returns the parsed counter or zero", async () => {
    const store = new Map<string, FakeEntry>([["clicks:gh", entry("12")]]);
    const client = fakeClient(store);
    expect(await getClicks(client, "gh")).toBe(12);
    expect(await getClicks(client, "unseen")).toBe(0);
  });
});

describe("listLinks", () => {
  it("returns link records and skips click-counter keys", async () => {
    const store = new Map<string, FakeEntry>([
      ["gh", entry(JSON.stringify(record))],
      ["clicks:gh", entry("5")],
      ["yt", entry(JSON.stringify({ ...record, url: "https://youtube.com" }))],
    ]);

    const { links } = await listLinks(fakeClient(store));

    expect(links.map((l) => l.slug).sort()).toEqual(["gh", "yt"]);
  });

  it("filters out keys whose expiration is in the past", async () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    const future = Math.floor(Date.now() / 1000) + 3600;
    const store = new Map<string, FakeEntry>([
      ["live", entry(JSON.stringify(record), future)],
      ["dead", entry(JSON.stringify(record), past)],
      ["perm", entry(JSON.stringify(record))],
    ]);

    const { links } = await listLinks(fakeClient(store));

    expect(links.map((l) => l.slug).sort()).toEqual(["live", "perm"]);
  });
});
