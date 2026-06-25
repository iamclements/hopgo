/**
 * Cloudflare OAuth (Authorization Code + PKCE) for Hopgo onboarding.
 *
 * Cloudflare shipped self-managed OAuth clients in June 2026, so Hopgo can offer
 * "Connect Cloudflare" instead of asking users to paste a scoped API token. The
 * resulting opaque access token is used as a Bearer against api.cloudflare.com,
 * exactly like a token, so CloudflareKvClient consumes it unchanged.
 *
 * This module is pure and runtime-agnostic (Node, Workers, browser): it relies
 * only on the global Web Crypto API and fetch. Token storage is the caller's job,
 * since it differs per platform (a volume file in the container, chrome.storage in
 * the extension).
 */

const DEFAULT_AUTH_BASE = "https://dash.cloudflare.com";

/** Scopes Hopgo needs: read the account, edit Workers KV, and get a refresh token. */
export const HOPGO_OAUTH_SCOPES = ["account:read", "workers_kv:write", "offline_access"] as const;

/** Clock skew applied when deciding whether an access token is still usable. */
const EXPIRY_SKEW_MS = 30_000;

export interface OAuthConfig {
  clientId: string;
  redirectUri: string;
  /** Defaults to HOPGO_OAUTH_SCOPES. */
  scopes?: readonly string[];
  /** Override the dashboard origin (tests). Defaults to dash.cloudflare.com. */
  authBaseUrl?: string;
  /** Inject fetch (tests). Defaults to the global fetch. */
  fetch?: typeof fetch;
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms at which the access token expires. */
  expiresAt: number;
  scope?: string;
}

export class OAuthError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "OAuthError";
  }
}

export interface PkcePair {
  verifier: string;
  challenge: string;
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomBase64url(byteLength: number): string {
  return base64url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

/** Create a PKCE verifier and its S256 challenge. */
export async function createPkcePair(): Promise<PkcePair> {
  const verifier = randomBase64url(32);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

/** Random CSRF state value to round-trip through the authorize redirect. */
export function randomState(): string {
  return randomBase64url(16);
}

function authBase(config: OAuthConfig): string {
  return (config.authBaseUrl ?? DEFAULT_AUTH_BASE).replace(/\/+$/, "");
}

function scopeString(config: OAuthConfig): string {
  return (config.scopes ?? HOPGO_OAUTH_SCOPES).join(" ");
}

/** Build the authorize URL to open in the user's browser. */
export function buildAuthorizeUrl(
  config: OAuthConfig,
  params: { state: string; codeChallenge: string },
): string {
  const url = new URL(`${authBase(config)}/oauth2/auth`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", scopeString(config));
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

async function postToken(
  config: OAuthConfig,
  body: Record<string, string>,
  now: number,
): Promise<TokenSet> {
  const fetchImpl = config.fetch ?? globalThis.fetch;
  const res = await fetchImpl(`${authBase(config)}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });

  const json = (await res.json().catch(() => null)) as (TokenResponse & { error?: string }) | null;
  if (!res.ok || !json?.access_token) {
    throw new OAuthError(json?.error ?? `Token request failed (HTTP ${res.status})`, res.status);
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: now + (json.expires_in ?? 0) * 1000,
    scope: json.scope,
  };
}

/** Exchange an authorization code for tokens. */
export function exchangeCode(
  config: OAuthConfig,
  params: { code: string; codeVerifier: string },
  now: number = Date.now(),
): Promise<TokenSet> {
  return postToken(
    config,
    {
      grant_type: "authorization_code",
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      code: params.code,
      code_verifier: params.codeVerifier,
    },
    now,
  );
}

/** Exchange a refresh token for a fresh access token. */
export function refreshTokens(
  config: OAuthConfig,
  refreshToken: string,
  now: number = Date.now(),
): Promise<TokenSet> {
  return postToken(
    config,
    {
      grant_type: "refresh_token",
      client_id: config.clientId,
      refresh_token: refreshToken,
    },
    now,
  );
}

/** True when the access token is expired or within the skew window. */
export function isTokenExpired(tokens: TokenSet, now: number = Date.now()): boolean {
  return now >= tokens.expiresAt - EXPIRY_SKEW_MS;
}
