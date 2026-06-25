import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthorizeUrl,
  createPkcePair,
  exchangeCode,
  HOPGO_OAUTH_SCOPES,
  isTokenExpired,
  OAuthError,
  randomState,
  refreshTokens,
  type OAuthConfig,
} from "./oauth.js";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
});

function config(): OAuthConfig {
  return {
    clientId: "client-123",
    redirectUri: "http://localhost:8976/oauth/callback",
    authBaseUrl: "https://dash.example.com",
    fetch: fetchMock as unknown as typeof fetch,
  };
}

function tokenResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("createPkcePair", () => {
  it("produces a verifier and a different S256 challenge", async () => {
    const { verifier, challenge } = await createPkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).not.toBe(verifier);
  });

  it("randomState is unique and url-safe", () => {
    expect(randomState()).not.toBe(randomState());
    expect(randomState()).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("buildAuthorizeUrl", () => {
  it("includes PKCE, scopes, and the redirect", () => {
    const url = new URL(buildAuthorizeUrl(config(), { state: "st", codeChallenge: "ch" }));
    expect(url.origin + url.pathname).toBe("https://dash.example.com/oauth2/auth");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("code_challenge")).toBe("ch");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("scope")).toBe(HOPGO_OAUTH_SCOPES.join(" "));
  });
});

describe("exchangeCode", () => {
  it("posts the code with the verifier and parses the token set", async () => {
    fetchMock.mockResolvedValue(
      tokenResponse({ access_token: "at", refresh_token: "rt", expires_in: 3600, scope: "x" }),
    );

    const tokens = await exchangeCode(config(), { code: "abc", codeVerifier: "ver" }, 1_000);

    expect(tokens).toEqual({
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: 1_000 + 3600_000,
      scope: "x",
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://dash.example.com/oauth2/token");
    const body = new URLSearchParams((init as RequestInit).body as string);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("abc");
    expect(body.get("code_verifier")).toBe("ver");
    expect(body.get("client_id")).toBe("client-123");
  });

  it("throws OAuthError on failure", async () => {
    fetchMock.mockResolvedValue(tokenResponse({ error: "invalid_grant" }, 400));
    await expect(exchangeCode(config(), { code: "x", codeVerifier: "y" })).rejects.toBeInstanceOf(
      OAuthError,
    );
  });
});

describe("refreshTokens", () => {
  it("posts the refresh token", async () => {
    fetchMock.mockResolvedValue(tokenResponse({ access_token: "at2", expires_in: 100 }));
    const tokens = await refreshTokens(config(), "rt", 0);
    expect(tokens.accessToken).toBe("at2");
    const body = new URLSearchParams((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("rt");
  });
});

describe("isTokenExpired", () => {
  it("respects the skew window", () => {
    expect(isTokenExpired({ accessToken: "a", expiresAt: 100_000 }, 50_000)).toBe(false);
    expect(isTokenExpired({ accessToken: "a", expiresAt: 100_000 }, 99_990)).toBe(true);
  });
});
