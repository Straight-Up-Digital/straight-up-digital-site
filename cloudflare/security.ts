import type { CloudflareWorkerEnv } from "./types.ts";
import type { PrivateDataStore } from "./storage.ts";
import { hashRateKey } from "./storage.ts";

export const isProduction = (env: CloudflareWorkerEnv): boolean => env.APP_ENV === "production";

export async function bearerAuthorized(request: Request, expected: string | undefined, minLength = 40): Promise<boolean> {
  if (!expected || expected.length < minLength) return false;
  const match = /^Bearer\s+([A-Za-z0-9_-]{40,256})$/i.exec(request.headers.get("authorization") || "");
  if (!match) return false;
  const [left, right] = await Promise.all([sha256(match[1]), sha256(expected)]);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

export class RateLimitUnavailable extends Error {}
export interface RateLimitResult { allowed: boolean; retryAfter: number }

export async function rateLimit(
  request: Request,
  env: CloudflareWorkerEnv,
  store: PrivateDataStore,
  route: string,
  limit: number,
  windowSeconds: number,
  nowMs = Date.now(),
): Promise<RateLimitResult> {
  const secret = env.RATE_LIMIT_HASH_SECRET || (env.APP_ENV === "development" || env.APP_ENV === "test" ? "local-only-rate-limit-salt" : "");
  if (!secret) throw new RateLimitUnavailable("The hashed rate-limit key secret is not configured.");
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const spanMs = windowSeconds * 1000;
  const windowStart = Math.floor(nowMs / spanMs) * spanMs;
  const key = await hashRateKey(secret, route, ip);
  const count = await store.incrementRateLimit(key, windowStart, windowStart + spanMs * 2);
  return { allowed: count <= limit, retryAfter: Math.max(1, Math.ceil((windowStart + spanMs - nowMs) / 1000)) };
}
