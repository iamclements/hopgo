import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import worker, { type StoredLink } from "../src/index.js";

const link: StoredLink = {
  url: "https://example.com/destination",
  tenantId: "local",
  createdAt: "2026-06-01T00:00:00.000Z",
};

async function dispatch(path: string, init?: RequestInit): Promise<Response> {
  const ctx = createExecutionContext();
  const res = await worker.fetch(new Request(`https://hopgo.co${path}`, init), env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

beforeEach(async () => {
  // Clear KV between tests so click counts and links do not leak across cases.
  const { keys } = await env.LINKS.list();
  await Promise.all(keys.map((k) => env.LINKS.delete(k.name)));
});

describe("worker redirect", () => {
  it("302s a known slug to its target", async () => {
    await env.LINKS.put("gh", JSON.stringify(link));

    const res = await dispatch("/gh");

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(link.url);
  });

  it("404s an unknown slug", async () => {
    const res = await dispatch("/missing");

    expect(res.status).toBe(404);
  });

  it("increments the click counter after redirecting", async () => {
    await env.LINKS.put("gh", JSON.stringify(link));

    await dispatch("/gh");
    await dispatch("/gh");

    expect(await env.LINKS.get("clicks:gh")).toBe("2");
  });

  it("does not count clicks on a miss", async () => {
    await dispatch("/missing");

    expect(await env.LINKS.get("clicks:missing")).toBeNull();
  });

  it("serves the HTML landing page at the apex root", async () => {
    const res = await dispatch("/");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("<h1>Hopgo</h1>");
  });

  it("rejects non-GET methods", async () => {
    await env.LINKS.put("gh", JSON.stringify(link));

    const res = await dispatch("/gh", { method: "POST" });

    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET, HEAD");
  });
});
