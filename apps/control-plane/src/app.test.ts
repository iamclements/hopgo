import { CloudflareKvClient, type Link } from "@hopgo/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";

let store: Map<string, string>;

/** A KV client backed by an in-memory map, so tests never touch the network. */
function makeApp() {
  const client = new CloudflareKvClient({ apiToken: "t", accountId: "a", namespaceId: "n" });
  vi.spyOn(client, "readValue").mockImplementation(async (k) => store.get(k) ?? null);
  vi.spyOn(client, "writeValue").mockImplementation(async (k, v) => {
    store.set(k, v);
  });
  vi.spyOn(client, "deleteValue").mockImplementation(async (k) => {
    store.delete(k);
  });
  vi.spyOn(client, "listKeys").mockImplementation(async () => ({
    keys: [...store.keys()].map((name) => ({ name })),
    listComplete: true,
  }));
  return createApp({ client, tenantId: "local" });
}

function postLink(app: ReturnType<typeof createApp>, payload: unknown) {
  return app.request("/api/links", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

beforeEach(() => {
  store = new Map();
});

describe("POST /api/links", () => {
  it("creates a link with an auto-generated slug and the local tenant", async () => {
    const app = makeApp();
    const res = await postLink(app, { url: "https://example.com" });

    expect(res.status).toBe(201);
    const body = (await res.json()) as Link;
    expect(body.slug).toMatch(/^[0-9A-Za-z]{7}$/);
    expect(body.tenantId).toBe("local");
    expect(store.has(body.slug)).toBe(true);
  });

  it("honors a valid custom slug", async () => {
    const app = makeApp();
    const res = await postLink(app, { url: "https://example.com", slug: "gh" });

    expect(res.status).toBe(201);
    expect(((await res.json()) as Link).slug).toBe("gh");
  });

  it("rejects a non-http url", async () => {
    const res = await postLink(makeApp(), { url: "ftp://example.com" });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid custom slug", async () => {
    const res = await postLink(makeApp(), { url: "https://example.com", slug: "has space" });
    expect(res.status).toBe(400);
  });

  it("409s on a duplicate custom slug", async () => {
    const app = makeApp();
    await postLink(app, { url: "https://example.com", slug: "gh" });
    const res = await postLink(app, { url: "https://other.com", slug: "gh" });
    expect(res.status).toBe(409);
  });
});

describe("GET /api/links", () => {
  it("lists created links and skips click counters", async () => {
    const app = makeApp();
    await postLink(app, { url: "https://example.com", slug: "gh" });
    store.set("clicks:gh", "5");

    const res = await app.request("/api/links");
    const body = (await res.json()) as { links: Link[] };

    expect(res.status).toBe(200);
    expect(body.links.map((l) => l.slug)).toEqual(["gh"]);
  });
});

describe("GET /api/links/:slug", () => {
  it("returns the link with its click count", async () => {
    const app = makeApp();
    await postLink(app, { url: "https://example.com", slug: "gh" });
    store.set("clicks:gh", "12");

    const res = await app.request("/api/links/gh");
    const body = (await res.json()) as Link & { clicks: number };

    expect(res.status).toBe(200);
    expect(body.clicks).toBe(12);
  });

  it("404s an unknown slug", async () => {
    const res = await makeApp().request("/api/links/missing");
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/links/:slug", () => {
  it("removes the link and its counter", async () => {
    const app = makeApp();
    await postLink(app, { url: "https://example.com", slug: "gh" });
    store.set("clicks:gh", "5");

    const res = await app.request("/api/links/gh", { method: "DELETE" });

    expect(res.status).toBe(204);
    expect(store.has("gh")).toBe(false);
    expect(store.has("clicks:gh")).toBe(false);
  });

  it("404s when deleting an unknown slug", async () => {
    const res = await makeApp().request("/api/links/missing", { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});

describe("GET /health", () => {
  it("reports ok", async () => {
    const res = await makeApp().request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
