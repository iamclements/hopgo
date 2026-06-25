/**
 * Hopgo preflight checks. Verifies the operator's Cloudflare setup before they
 * rely on it: required env, the scoped token, KV reachability, and whether the
 * edge worker is actually serving. Run it locally (pnpm doctor) or in the
 * container (docker compose run --rm control-plane node dist/doctor.js).
 *
 * The checks are exported as pure functions taking injected fetch/client so they
 * are unit testable without touching the network.
 */
import { fileURLToPath } from "node:url";
import { CloudflareApiError, CloudflareKvClient } from "@hopgo/shared";

const CF_API = "https://api.cloudflare.com/client/v4";

export type CheckStatus = "pass" | "fail" | "warn" | "skip";

export interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
}

export interface DoctorEnv {
  CF_API_TOKEN?: string;
  CF_ACCOUNT_ID?: string;
  CF_KV_NAMESPACE_ID?: string;
  HOPGO_PUBLIC_BASE_URL?: string;
}

export function checkEnv(env: DoctorEnv): CheckResult {
  const required = ["CF_API_TOKEN", "CF_ACCOUNT_ID", "CF_KV_NAMESPACE_ID"] as const;
  const missing = required.filter((key) => !env[key]);
  if (missing.length) {
    return { name: "env", status: "fail", detail: `missing: ${missing.join(", ")}` };
  }
  return { name: "env", status: "pass", detail: "required env vars set" };
}

/** Verify the scoped token is active via the Cloudflare token-verify endpoint. */
export async function checkToken(token: string, fetchImpl: typeof fetch): Promise<CheckResult> {
  try {
    const res = await fetchImpl(`${CF_API}/user/tokens/verify`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = (await res.json().catch(() => null)) as {
      success?: boolean;
      result?: { status?: string };
    } | null;
    if (res.ok && body?.success && body.result?.status === "active") {
      return { name: "token", status: "pass", detail: "token is valid and active" };
    }
    return { name: "token", status: "fail", detail: `token verify failed (HTTP ${res.status})` };
  } catch (err) {
    return { name: "token", status: "fail", detail: `token verify error: ${asMessage(err)}` };
  }
}

/** Confirm the KV namespace is reachable with the token (account + namespace + KV scope). */
export async function checkKv(client: CloudflareKvClient): Promise<CheckResult> {
  try {
    await client.listKeys({ limit: 1 });
    return { name: "kv", status: "pass", detail: "KV namespace reachable" };
  } catch (err) {
    const detail =
      err instanceof CloudflareApiError
        ? `KV unreachable (HTTP ${err.status}); check account id, namespace id, and KV scope`
        : `KV error: ${asMessage(err)}`;
    return { name: "kv", status: "fail", detail };
  }
}

/** Probe the public origin with an unknown slug; a 404 means the worker is serving. */
export async function checkWorkerRoute(
  baseUrl: string,
  fetchImpl: typeof fetch,
): Promise<CheckResult> {
  const probe = `${baseUrl.replace(/\/+$/, "")}/__hopgo_doctor_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const res = await fetchImpl(probe, { redirect: "manual" });
    if (res.status === 404) {
      return { name: "worker route", status: "pass", detail: `worker serving at ${baseUrl}` };
    }
    return {
      name: "worker route",
      status: "warn",
      detail: `unexpected HTTP ${res.status} from ${baseUrl}; is the route bound to the worker?`,
    };
  } catch (err) {
    return {
      name: "worker route",
      status: "fail",
      detail: `no response from ${baseUrl}: ${asMessage(err)}`,
    };
  }
}

export async function runDoctor(
  env: DoctorEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<CheckResult[]> {
  const results: CheckResult[] = [checkEnv(env)];

  if (env.CF_API_TOKEN) {
    results.push(await checkToken(env.CF_API_TOKEN, fetchImpl));
  } else {
    results.push({ name: "token", status: "skip", detail: "no CF_API_TOKEN" });
  }

  if (env.CF_API_TOKEN && env.CF_ACCOUNT_ID && env.CF_KV_NAMESPACE_ID) {
    const client = new CloudflareKvClient({
      apiToken: env.CF_API_TOKEN,
      accountId: env.CF_ACCOUNT_ID,
      namespaceId: env.CF_KV_NAMESPACE_ID,
      fetch: fetchImpl,
    });
    results.push(await checkKv(client));
  } else {
    results.push({ name: "kv", status: "skip", detail: "missing CF_* env" });
  }

  results.push(await checkWorkerRoute(env.HOPGO_PUBLIC_BASE_URL || "https://hopgo.co", fetchImpl));
  return results;
}

const STATUS_ICON: Record<CheckStatus, string> = { pass: "✓", fail: "✗", warn: "!", skip: "-" };

export function formatResults(results: CheckResult[]): string {
  return results.map((r) => `${STATUS_ICON[r.status]} ${r.name}: ${r.detail}`).join("\n");
}

function asMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function main(): Promise<void> {
  const results = await runDoctor(process.env as DoctorEnv);
  console.log(formatResults(results));
  process.exit(results.some((r) => r.status === "fail") ? 1 : 0);
}

// Run only when invoked directly, not when imported by tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main();
}
