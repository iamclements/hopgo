import { beforeEach, describe, expect, it, vi } from "vitest";
import { CloudflareApiError, CloudflareKvClient } from "./cloudflare.js";

const config = {
  apiToken: "test-token",
  accountId: "acct123",
  namespaceId: "ns456",
};

function ok<T>(result: T, resultInfo?: { cursor?: string }): Response {
  return new Response(
    JSON.stringify({ success: true, errors: [], result, result_info: resultInfo }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
});

function client() {
  return new CloudflareKvClient({ ...config, fetch: fetchMock as unknown as typeof fetch });
}

describe("readValue", () => {
  it("returns the raw value and sends a bearer token", async () => {
    fetchMock.mockResolvedValue(new Response("https://example.com", { status: 200 }));

    const value = await client().readValue("slug");

    expect(value).toBe("https://example.com");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/acct123/storage/kv/namespaces/ns456/values/slug",
    );
    expect((init as RequestInit).headers).toMatchObject({ authorization: "Bearer test-token" });
  });

  it("returns null on 404", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 404 }));
    expect(await client().readValue("missing")).toBeNull();
  });

  it("throws on other errors", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 500 }));
    await expect(client().readValue("slug")).rejects.toBeInstanceOf(CloudflareApiError);
  });

  it("url-encodes the key", async () => {
    fetchMock.mockResolvedValue(new Response("x", { status: 200 }));
    await client().readValue("clicks:a b");
    expect(fetchMock.mock.calls[0]![0]).toContain("/values/clicks%3Aa%20b");
  });
});

describe("writeValue", () => {
  it("PUTs the body and accepts the success envelope", async () => {
    fetchMock.mockResolvedValue(ok(null));

    await client().writeValue("slug", "payload");

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("PUT");
    expect((init as RequestInit).body).toBe("payload");
  });

  it("throws when the envelope reports failure", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false, errors: [{ code: 10001, message: "nope" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(client().writeValue("slug", "x")).rejects.toBeInstanceOf(CloudflareApiError);
  });
});

describe("deleteValue", () => {
  it("sends DELETE", async () => {
    fetchMock.mockResolvedValue(ok(null));
    await client().deleteValue("slug");
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe("DELETE");
  });
});

describe("listKeys", () => {
  it("parses keys and the pagination cursor", async () => {
    fetchMock.mockResolvedValue(ok([{ name: "a" }, { name: "b" }], { cursor: "next" }));

    const result = await client().listKeys({ prefix: "a", limit: 10 });

    expect(result.keys.map((k) => k.name)).toEqual(["a", "b"]);
    expect(result.cursor).toBe("next");
    expect(result.listComplete).toBe(false);
    expect(fetchMock.mock.calls[0]![0]).toContain("/keys?prefix=a&limit=10");
  });

  it("marks the list complete when no cursor is returned", async () => {
    fetchMock.mockResolvedValue(ok([{ name: "a" }]));
    const result = await client().listKeys();
    expect(result.listComplete).toBe(true);
    expect(result.cursor).toBeUndefined();
  });
});
