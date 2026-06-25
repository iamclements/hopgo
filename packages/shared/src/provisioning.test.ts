import { describe, expect, it, vi } from "vitest";
import { CloudflareApiError } from "./cloudflare.js";
import {
  deployWorker,
  ensureDnsRecord,
  ensureRoute,
  listZones,
  provisionDomain,
} from "./provisioning.js";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const ok = (result: unknown) => json({ success: true, errors: [], result });

describe("listZones", () => {
  it("returns the zones", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([{ id: "z1", name: "example.com" }]));
    const zones = await listZones(fetchMock as unknown as typeof fetch, "tok");
    expect(zones).toEqual([{ id: "z1", name: "example.com" }]);
  });

  it("throws on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ success: false, errors: [] }, 403));
    await expect(listZones(fetchMock as unknown as typeof fetch, "tok")).rejects.toBeInstanceOf(
      CloudflareApiError,
    );
  });
});

describe("deployWorker", () => {
  it("PUTs a multipart upload with the KV binding", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: "hopgo" }));
    await deployWorker(fetchMock as unknown as typeof fetch, "tok", {
      accountId: "acct1",
      namespaceId: "ns1",
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acct1/workers/scripts/hopgo");
    expect((init as RequestInit).method).toBe("PUT");
    expect((init as RequestInit).body).toBeInstanceOf(FormData);
    const form = (init as RequestInit).body as FormData;
    const metadata = JSON.parse(await (form.get("metadata") as Blob).text());
    expect(metadata.bindings[0]).toMatchObject({
      type: "kv_namespace",
      name: "LINKS",
      namespace_id: "ns1",
    });
    expect(metadata.main_module).toBe("worker.js");
  });

  it("throws when the upload fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ success: false, errors: [] }, 400));
    await expect(
      deployWorker(fetchMock as unknown as typeof fetch, "tok", {
        accountId: "a",
        namespaceId: "n",
      }),
    ).rejects.toBeInstanceOf(CloudflareApiError);
  });
});

describe("ensureRoute", () => {
  it("creates the route when absent", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok({ id: "r1" }));
    await ensureRoute(fetchMock as unknown as typeof fetch, "tok", "z1", "example.com/*");

    expect((fetchMock.mock.calls[1]![1] as RequestInit).method).toBe("POST");
    const body = JSON.parse((fetchMock.mock.calls[1]![1] as RequestInit).body as string);
    expect(body).toEqual({ pattern: "example.com/*", script: "hopgo" });
  });

  it("skips creation when the route already exists", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok([{ pattern: "example.com/*", script: "hopgo" }]));
    await ensureRoute(fetchMock as unknown as typeof fetch, "tok", "z1", "example.com/*");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("ensureDnsRecord", () => {
  it("creates a proxied AAAA when no proxied record exists", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok([{ id: "d1", proxied: false }]))
      .mockResolvedValueOnce(ok({ id: "d2" }));

    await ensureDnsRecord(fetchMock as unknown as typeof fetch, "tok", "z1", "go.example.com");

    const body = JSON.parse((fetchMock.mock.calls[1]![1] as RequestInit).body as string);
    expect(body).toMatchObject({
      type: "AAAA",
      name: "go.example.com",
      content: "100::",
      proxied: true,
    });
  });

  it("skips creation when a proxied record already exists", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok([{ id: "d1", proxied: true }]));
    await ensureDnsRecord(fetchMock as unknown as typeof fetch, "tok", "z1", "go.example.com");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("provisionDomain", () => {
  it("deploys the worker then binds the route", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ id: "hopgo" })) // deploy
      .mockResolvedValueOnce(ok([])) // list routes
      .mockResolvedValueOnce(ok({ id: "r1" })); // create route

    await provisionDomain(fetchMock as unknown as typeof fetch, "tok", {
      accountId: "acct1",
      zoneId: "z1",
      pattern: "example.com/*",
      namespaceId: "ns1",
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]![0]).toContain("/workers/scripts/hopgo");
    expect(fetchMock.mock.calls[2]![0]).toContain("/zones/z1/workers/routes");
  });
});
