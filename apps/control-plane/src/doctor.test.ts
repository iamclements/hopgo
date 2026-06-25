import { CloudflareApiError, CloudflareKvClient } from "@hopgo/shared";
import { describe, expect, it, vi } from "vitest";
import {
  checkEnv,
  checkKv,
  checkToken,
  checkWorkerRoute,
  runDoctor,
  type DoctorEnv,
} from "./doctor.js";

const fullEnv: DoctorEnv = {
  CF_API_TOKEN: "tok",
  CF_ACCOUNT_ID: "acct",
  CF_KV_NAMESPACE_ID: "ns",
  HOPGO_PUBLIC_BASE_URL: "https://hopgo.co",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("checkEnv", () => {
  it("passes when all required vars are set", () => {
    expect(checkEnv(fullEnv).status).toBe("pass");
  });

  it("fails and lists what is missing", () => {
    const result = checkEnv({ CF_API_TOKEN: "tok" });
    expect(result.status).toBe("fail");
    expect(result.detail).toContain("CF_ACCOUNT_ID");
    expect(result.detail).toContain("CF_KV_NAMESPACE_ID");
  });
});

describe("checkToken", () => {
  it("passes for an active token", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ success: true, result: { status: "active" } }));
    const result = await checkToken("tok", fetchImpl as unknown as typeof fetch);
    expect(result.status).toBe("pass");
    expect(fetchImpl.mock.calls[0]![1].headers).toMatchObject({ authorization: "Bearer tok" });
  });

  it("fails for an inactive or rejected token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ success: false }, 401));
    expect((await checkToken("tok", fetchImpl as unknown as typeof fetch)).status).toBe("fail");
  });
});

describe("checkKv", () => {
  it("passes when listKeys succeeds", async () => {
    const client = new CloudflareKvClient({ apiToken: "t", accountId: "a", namespaceId: "n" });
    vi.spyOn(client, "listKeys").mockResolvedValue({ keys: [], listComplete: true });
    expect((await checkKv(client)).status).toBe("pass");
  });

  it("fails and surfaces the HTTP status on a Cloudflare error", async () => {
    const client = new CloudflareKvClient({ apiToken: "t", accountId: "a", namespaceId: "n" });
    vi.spyOn(client, "listKeys").mockRejectedValue(new CloudflareApiError("nope", 403));
    const result = await checkKv(client);
    expect(result.status).toBe("fail");
    expect(result.detail).toContain("403");
  });
});

describe("checkWorkerRoute", () => {
  it("passes when an unknown slug returns 404", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    expect(
      (await checkWorkerRoute("https://hopgo.co", fetchImpl as unknown as typeof fetch)).status,
    ).toBe("pass");
  });

  it("warns on an unexpected status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    expect(
      (await checkWorkerRoute("https://hopgo.co", fetchImpl as unknown as typeof fetch)).status,
    ).toBe("warn");
  });

  it("fails when the origin does not respond", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    expect(
      (await checkWorkerRoute("https://hopgo.co", fetchImpl as unknown as typeof fetch)).status,
    ).toBe("fail");
  });
});

describe("runDoctor", () => {
  it("skips token and kv checks when env is incomplete", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    const results = await runDoctor({}, fetchImpl as unknown as typeof fetch);
    const byName = Object.fromEntries(results.map((r) => [r.name, r.status]));
    expect(byName.env).toBe("fail");
    expect(byName.token).toBe("skip");
    expect(byName.kv).toBe("skip");
    expect(byName["worker route"]).toBe("pass");
  });
});
