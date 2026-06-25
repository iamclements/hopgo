import { describe, expect, it, vi } from "vitest";
import { CloudflareApiError } from "./cloudflare.js";
import { discoverAccountId, ensureNamespace } from "./discovery.js";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("discoverAccountId", () => {
  it("returns the first account id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json({ success: true, errors: [], result: [{ id: "acct1", name: "A" }] }));
    expect(await discoverAccountId(fetchMock as unknown as typeof fetch, "tok")).toBe("acct1");
  });

  it("throws when no accounts are accessible", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ success: true, errors: [], result: [] }));
    await expect(discoverAccountId(fetchMock as unknown as typeof fetch, "tok")).rejects.toThrow(
      /No Cloudflare account/,
    );
  });

  it("throws CloudflareApiError on a failed call", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ success: false, errors: [] }, 403));
    await expect(
      discoverAccountId(fetchMock as unknown as typeof fetch, "tok"),
    ).rejects.toBeInstanceOf(CloudflareApiError);
  });
});

describe("ensureNamespace", () => {
  it("returns the id of an existing namespace by title", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        json({ success: true, errors: [], result: [{ id: "ns1", title: "hopgo-links" }] }),
      );
    expect(await ensureNamespace(fetchMock as unknown as typeof fetch, "tok", "acct1")).toBe("ns1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("creates the namespace when missing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ success: true, errors: [], result: [] }))
      .mockResolvedValueOnce(json({ success: true, errors: [], result: { id: "ns2" } }));

    expect(await ensureNamespace(fetchMock as unknown as typeof fetch, "tok", "acct1")).toBe("ns2");
    expect((fetchMock.mock.calls[1]![1] as RequestInit).method).toBe("POST");
  });
});
