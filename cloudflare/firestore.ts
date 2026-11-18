import type { CloudflareWorkerEnv } from "./types.ts";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DATASTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const FIRESTORE_API = "https://firestore.googleapis.com/v1";
const REQUEST_TIMEOUT_MS = 8_000;

export interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  nullValue?: null | string;
  mapValue?: { fields?: Record<string, FirestoreValue> };
}

export interface FirestoreDocument {
  name?: string;
  fields?: Record<string, FirestoreValue>;
}

export interface FirestoreClientOptions {
  fetcher?: typeof fetch;
  now?: () => number;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  private_key_id?: string;
}

interface TokenResponse {
  access_token?: unknown;
  expires_in?: unknown;
}

interface TokenCacheEntry {
  fingerprint: string;
  token: string;
  expiresAt: number;
}

let cachedToken: TokenCacheEntry | null = null;

export class FirestoreError extends Error {
  readonly status: number;
  readonly operation: string;
  readonly stage: "jwt_sign" | "oauth_fetch" | undefined;
  readonly failureType: "timeout" | "network" | undefined;
  readonly causeName: string | undefined;
  readonly causeMessage: string | undefined;

  constructor(status: number, operation: string, stage?: "jwt_sign" | "oauth_fetch", failureType?: "timeout" | "network", cause?: unknown) {
    super(`firestore_${operation}_failed`);
    this.name = "FirestoreError";
    this.status = status;
    this.operation = operation;
    this.stage = stage;
    this.failureType = failureType;
    this.causeName = cause instanceof Error ? cause.name.replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80) : undefined;
    this.causeMessage = cause instanceof Error ? cause.message.replace(/[\r\n\t]+/g, " ").replace(/(?:Bearer\s+)[A-Za-z0-9._~-]+/gi, "Bearer [redacted]").replace(/[A-Za-z0-9_-]{100,}/g, "[redacted]").slice(0, 200) : undefined;
  }
}

const base64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};

const encodeJson = (value: unknown): string => base64Url(new TextEncoder().encode(JSON.stringify(value)));

const readServiceAccount = (raw: string): ServiceAccount => {
  if (!raw || raw.length > 24_000) throw new FirestoreError(0, "configuration");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new FirestoreError(0, "configuration"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new FirestoreError(0, "configuration");
  const value = parsed as Record<string, unknown>;
  const email = value.client_email;
  const privateKey = value.private_key;
  const privateKeyId = value.private_key_id;
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/.test(email)
    || typeof privateKey !== "string" || !privateKey.includes("-----BEGIN PRIVATE KEY-----")
    || !privateKey.includes("-----END PRIVATE KEY-----")
    || (privateKeyId !== undefined && typeof privateKeyId !== "string")) {
    throw new FirestoreError(0, "configuration");
  }
  return { client_email: email, private_key: privateKey, ...(typeof privateKeyId === "string" ? { private_key_id: privateKeyId } : {}) };
};

const importPrivateKey = async (pem: string): Promise<CryptoKey> => {
  const encoded = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  let binary: string;
  try { binary = atob(encoded); } catch { throw new FirestoreError(0, "configuration"); }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  try {
    return await crypto.subtle.importKey("pkcs8", bytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  } catch {
    throw new FirestoreError(0, "configuration");
  }
};

const timeoutSignal = (): AbortSignal | undefined =>
  typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined;

export class FirestoreRestClient {
  readonly projectId: string;
  private readonly account: ServiceAccount;
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  private privateKeyPromise: Promise<CryptoKey> | null = null;
  private readonly root: string;

  constructor(projectId: string, serviceAccountJson: string, options: FirestoreClientOptions = {}) {
    if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) throw new FirestoreError(0, "configuration");
    this.projectId = projectId;
    this.account = readServiceAccount(serviceAccountJson);
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.now = options.now ?? Date.now;
    this.root = `${FIRESTORE_API}/projects/${projectId}/databases/(default)/documents`;
  }

  documentName(collection: string, id: string): string {
    return `projects/${this.projectId}/databases/(default)/documents/${collection}/${id}`;
  }

  private async accessToken(): Promise<string> {
    const keyFingerprint = this.account.private_key_id || `${this.account.client_email}:${this.account.private_key.length}`;
    const fingerprint = `${this.projectId}:${this.account.client_email}:${keyFingerprint}`;
    const now = this.now();
    if (cachedToken && cachedToken.fingerprint === fingerprint && cachedToken.expiresAt > now + 60_000) {
      return cachedToken.token;
    }

    if (!this.privateKeyPromise) this.privateKeyPromise = importPrivateKey(this.account.private_key);
    const key = await this.privateKeyPromise;
    const issuedAt = Math.floor(now / 1000);
    const header = { alg: "RS256", typ: "JWT", ...(this.account.private_key_id ? { kid: this.account.private_key_id } : {}) };
    const claims = {
      iss: this.account.client_email,
      scope: DATASTORE_SCOPE,
      aud: TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + 3_600,
    };
    const unsigned = `${encodeJson(header)}.${encodeJson(claims)}`;
    let signature: ArrayBuffer;
    try {
      signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
    } catch {
      throw new FirestoreError(0, "authentication", "jwt_sign");
    }
    const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    });

    let response: Response;
    try {
      const signal = timeoutSignal();
      response = await this.fetcher(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        ...(signal ? { signal } : {}),
      });
    } catch (error) {
      const failureType = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError") ? "timeout" : "network";
      throw new FirestoreError(0, "authentication", "oauth_fetch", failureType, error);
    }
    if (!response.ok) throw new FirestoreError(response.status, "authentication");

    let result: TokenResponse;
    try { result = await response.json() as TokenResponse; } catch { throw new FirestoreError(response.status, "authentication"); }
    if (typeof result.access_token !== "string" || !result.access_token || typeof result.expires_in !== "number" || !Number.isFinite(result.expires_in) || result.expires_in <= 60) {
      throw new FirestoreError(response.status, "authentication");
    }
    cachedToken = { fingerprint, token: result.access_token, expiresAt: now + result.expires_in * 1000 };
    return result.access_token;
  }

  private async request(url: string, init: RequestInit, operation: string): Promise<Response> {
    const token = await this.accessToken();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    try {
      const signal = timeoutSignal();
      return await this.fetcher(url, { ...init, headers, ...(signal ? { signal } : {}) });
    } catch {
      throw new FirestoreError(0, operation);
    }
  }

  private async readJson<T>(response: Response, operation: string): Promise<T> {
    if (!response.ok) throw new FirestoreError(response.status, operation);
    if (response.status === 204) return null as T;
    try {
      const text = await response.text();
      return (text ? JSON.parse(text) : null) as T;
    } catch {
      throw new FirestoreError(response.status, operation);
    }
  }

  async getDocument(collection: string, id: string): Promise<FirestoreDocument | null> {
    const response = await this.request(`${this.root}/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`, { method: "GET" }, "read");
    if (response.status === 404) return null;
    return this.readJson<FirestoreDocument>(response, "read");
  }

  async patchDocument(collection: string, id: string, fields: Record<string, FirestoreValue>, exists?: boolean): Promise<FirestoreDocument> {
    const url = new URL(`${this.root}/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`);
    if (exists !== undefined) url.searchParams.set("currentDocument.exists", String(exists));
    const body = JSON.stringify({ name: this.documentName(collection, id), fields });
    const response = await this.request(url.toString(), { method: "PATCH", body }, "write");
    return this.readJson<FirestoreDocument>(response, "write");
  }

  async deleteDocument(collection: string, id: string): Promise<boolean> {
    const response = await this.request(`${this.root}/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`, { method: "DELETE" }, "delete");
    if (response.status === 404) return false;
    await this.readJson<unknown>(response, "delete");
    return true;
  }

  async runQuery(structuredQuery: Record<string, unknown>): Promise<FirestoreDocument[]> {
    const response = await this.request(`${this.root}:runQuery`, { method: "POST", body: JSON.stringify({ structuredQuery }) }, "query");
    const result = await this.readJson<unknown>(response, "query");
    const entries = Array.isArray(result) ? result : (result && typeof result === "object" ? [result] : []);
    return entries.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const document = (entry as { document?: unknown }).document;
      return document && typeof document === "object" ? [document as FirestoreDocument] : [];
    });
  }

  async commit(writes: unknown[]): Promise<void> {
    if (!writes.length) return;
    const response = await this.request(`${this.root}:commit`, { method: "POST", body: JSON.stringify({ writes }) }, "write");
    await this.readJson<unknown>(response, "write");
  }
}

export const firestoreClientFromEnv = (env: Pick<CloudflareWorkerEnv, "FIRESTORE_PROJECT_ID" | "GOOGLE_FIRESTORE_SERVICE_ACCOUNT_JSON">, options: FirestoreClientOptions = {}): FirestoreRestClient => {
  const projectId = (env.FIRESTORE_PROJECT_ID || "").trim();
  const credentials = env.GOOGLE_FIRESTORE_SERVICE_ACCOUNT_JSON || "";
  if (!projectId || !credentials) throw new FirestoreError(0, "configuration");
  return new FirestoreRestClient(projectId, credentials, options);
};


export const hasFirestoreConfiguration = (env: Pick<CloudflareWorkerEnv, "FIRESTORE_PROJECT_ID" | "GOOGLE_FIRESTORE_SERVICE_ACCOUNT_JSON">): boolean =>
  Boolean(env.FIRESTORE_PROJECT_ID?.trim() && env.GOOGLE_FIRESTORE_SERVICE_ACCOUNT_JSON?.trim());
