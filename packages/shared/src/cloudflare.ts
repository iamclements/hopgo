/**
 * Minimal typed client for the Cloudflare Workers KV REST API.
 *
 * The control plane uses this to CRUD the same KV namespace the worker reads at
 * the edge. Auth is a SCOPED API token (Workers KV Storage edit on one account),
 * never the Global API Key. The token is passed in by the caller from env; this
 * module never reads env or hardcodes secrets.
 *
 * Kept deliberately low-level (raw key/value/list). Link-typed helpers live in
 * links.ts so the worker and the API stay loosely coupled through this client.
 */

const DEFAULT_BASE_URL = "https://api.cloudflare.com/client/v4";

export interface CloudflareKvConfig {
  /** Scoped API token (Bearer). */
  apiToken: string;
  accountId: string;
  namespaceId: string;
  /** Override for tests or self-hosted proxies. Defaults to the public API. */
  baseUrl?: string;
  /** Inject a fetch implementation (tests). Defaults to the global fetch. */
  fetch?: typeof fetch;
}

/** Thrown when the Cloudflare API returns a non-success response. */
export class CloudflareApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors: unknown = undefined,
  ) {
    super(message);
    this.name = "CloudflareApiError";
  }
}

interface CloudflareEnvelope<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: T;
  result_info?: { cursor?: string };
}

export interface KvKey {
  name: string;
  expiration?: number;
  metadata?: Record<string, unknown>;
}

export interface ListKeysResult {
  keys: KvKey[];
  /** Present when the list is paginated and more keys remain. */
  cursor?: string;
  listComplete: boolean;
}

export interface ListKeysOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

export class CloudflareKvClient {
  private readonly apiToken: string;
  private readonly accountId: string;
  private readonly namespaceId: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: CloudflareKvConfig) {
    this.apiToken = config.apiToken;
    this.accountId = config.accountId;
    this.namespaceId = config.namespaceId;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = config.fetch ?? globalThis.fetch;
  }

  private namespacePath(suffix: string): string {
    return `${this.baseUrl}/accounts/${this.accountId}/storage/kv/namespaces/${this.namespaceId}${suffix}`;
  }

  private get authHeaders(): Record<string, string> {
    return { authorization: `Bearer ${this.apiToken}` };
  }

  /** Read a raw value. Returns null when the key does not exist. */
  async readValue(key: string): Promise<string | null> {
    const res = await this.fetchImpl(this.namespacePath(`/values/${encodeURIComponent(key)}`), {
      headers: this.authHeaders,
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new CloudflareApiError(`Failed to read key "${key}"`, res.status);
    }
    return res.text();
  }

  /** Write a raw value. */
  async writeValue(key: string, value: string): Promise<void> {
    const res = await this.fetchImpl(this.namespacePath(`/values/${encodeURIComponent(key)}`), {
      method: "PUT",
      headers: { ...this.authHeaders, "content-type": "text/plain" },
      body: value,
    });
    await this.assertEnvelope(res, `write key "${key}"`);
  }

  /** Delete a key. Succeeds even if the key did not exist. */
  async deleteValue(key: string): Promise<void> {
    const res = await this.fetchImpl(this.namespacePath(`/values/${encodeURIComponent(key)}`), {
      method: "DELETE",
      headers: this.authHeaders,
    });
    await this.assertEnvelope(res, `delete key "${key}"`);
  }

  /** List keys, optionally filtered by prefix. Returns one page. */
  async listKeys(options: ListKeysOptions = {}): Promise<ListKeysResult> {
    const params = new URLSearchParams();
    if (options.prefix) params.set("prefix", options.prefix);
    if (options.limit) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();

    const res = await this.fetchImpl(this.namespacePath(`/keys${query ? `?${query}` : ""}`), {
      headers: this.authHeaders,
    });
    const envelope = await this.assertEnvelope<KvKey[]>(res, "list keys");
    const cursor = envelope.result_info?.cursor;
    return {
      keys: envelope.result,
      cursor: cursor || undefined,
      listComplete: !cursor,
    };
  }

  private async assertEnvelope<T>(res: Response, action: string): Promise<CloudflareEnvelope<T>> {
    let body: CloudflareEnvelope<T> | undefined;
    try {
      body = (await res.json()) as CloudflareEnvelope<T>;
    } catch {
      body = undefined;
    }
    if (!res.ok || !body?.success) {
      throw new CloudflareApiError(`Failed to ${action}`, res.status, body?.errors);
    }
    return body;
  }
}
