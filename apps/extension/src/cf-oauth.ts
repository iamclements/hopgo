/**
 * Sign in with Cloudflare from the extension using OAuth (Authorization Code +
 * PKCE) via chrome.identity. The extension calls Cloudflare directly, so there is
 * no backend and no CORS problem: host_permissions cover api.cloudflare.com and
 * the OAuth endpoints.
 *
 * No refresh token is requested (no offline_access): the access token lives in
 * extension storage until it expires, then the user signs in again (one click).
 */
import {
  buildAuthorizeUrl,
  createPkcePair,
  exchangeCode,
  randomState,
  type TokenSet,
} from "@hopgo/shared";

/** Hopgo's public OAuth client (PKCE, no secret). */
const CLIENT_ID = "13a19e6876148c2dfaa579cfb279893d";
const SCOPES = ["account:read", "workers_kv:write"];

/** Run the interactive OAuth flow and return the resulting tokens. */
export async function signInWithCloudflare(): Promise<TokenSet> {
  const redirectUri = chrome.identity.getRedirectURL();
  const config = { clientId: CLIENT_ID, redirectUri, scopes: SCOPES };

  const { verifier, challenge } = await createPkcePair();
  const state = randomState();
  const authUrl = buildAuthorizeUrl(config, { state, codeChallenge: challenge });

  const redirect = await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true });
  if (!redirect) {
    throw new Error("Sign-in was cancelled");
  }

  const params = new URL(redirect).searchParams;
  if (params.get("state") !== state) {
    throw new Error("OAuth state mismatch");
  }
  const error = params.get("error");
  if (error) {
    throw new Error(error);
  }
  const code = params.get("code");
  if (!code) {
    throw new Error("No authorization code returned");
  }

  return exchangeCode(config, { code, codeVerifier: verifier });
}

/** The redirect URL to register on the OAuth client (shown in options). */
export function redirectUrl(): string {
  return chrome.identity.getRedirectURL();
}
