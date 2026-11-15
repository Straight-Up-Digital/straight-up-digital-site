import { createHash, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
import { CRM_ENQUIRY_STORE, type StoredEnquiry } from "../lib/crm-enquiry-store.mts";

declare const Netlify: { env: { get(key: string): string | undefined } };

function getSecret(): string | undefined {
  try {
    if (typeof Netlify !== "undefined" && Netlify.env) {
      return Netlify.env.get("CRM_ENQUIRY_SYNC_TOKEN");
    }
  } catch {
    // Local test fallback only; production secrets are read through Netlify.env.
  }
  return process.env.CRM_ENQUIRY_SYNC_TOKEN;
}

function authorized(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  const expected = createHash("sha256").update(secret).digest();
  const supplied = createHash("sha256").update(match[1]).digest();
  return timingSafeEqual(expected, supplied);
}

function encodeCursor(record: StoredEnquiry): string {
  return Buffer.from(JSON.stringify([record.receivedAt, record.id])).toString("base64url");
}

function decodeCursor(value: string): [string, string] | null {
  if (!value) return null;
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (Array.isArray(decoded) && typeof decoded[0] === "string" && typeof decoded[1] === "string") {
      return [decoded[0], decoded[1]];
    }
  } catch {
    return null;
  }
  return null;
}

const json = (body: Record<string, unknown>, status = 200): Response =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Vary": "Authorization",
    },
  });

export async function handleCrmEnquiries(
  request: Request,
  context: Context,
  secretReader: () => string | undefined = getSecret,
): Promise<Response> {
  // These records are production client information. A branch or deploy preview
  // must not read, add to, or delete entries in the production site-wide store.
  if (context.deploy?.context !== "production") return json({ error: "not_found" }, 404);

  const secret = secretReader();
  if (!secret) return json({ error: "sync_not_configured" }, 503);
  if (!authorized(request, secret)) return json({ error: "unauthorized" }, 401);

  const store = getStore({ name: CRM_ENQUIRY_STORE, consistency: "strong" });
  try {
    if (request.method === "GET") {
      const url = new URL(request.url);
      const cursorText = url.searchParams.get("cursor") ?? "";
      const cursor = decodeCursor(cursorText);
      if (cursorText && !cursor) return json({ error: "invalid_cursor" }, 400);
      const records: StoredEnquiry[] = [];
      for await (const page of store.list({ paginate: true })) {
        for (const blob of page.blobs) {
          const value = await store.get(blob.key, { type: "json", consistency: "strong" });
          if (!value || typeof value !== "object") continue;
          const record = value as StoredEnquiry;
          if (typeof record.id !== "string" || typeof record.receivedAt !== "string" || !record.fields) continue;
          if (!cursor || record.receivedAt > cursor[0] || (record.receivedAt === cursor[0] && record.id > cursor[1])) {
            records.push(record);
          }
        }
      }
      records.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt) || a.id.localeCompare(b.id));
      const pageSize = 100;
      const items = records.slice(0, pageSize);
      return json({ items, nextCursor: items.length ? encodeCursor(items[items.length - 1]) : null, hasMore: records.length > pageSize });
    }

    if (request.method === "DELETE") {
      const text = await request.text();
      if (text.length > 8_000) return json({ error: "request_too_large" }, 413);
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        return json({ error: "invalid_json" }, 400);
      }
      const ids = (body as { ids?: unknown })?.ids;
      if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || ids.some((id) => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) {
        return json({ error: "invalid_ids" }, 400);
      }
      for (const id of ids as string[]) await store.delete(id);
      return json({ deleted: ids.length });
    }

    return json({ error: "method_not_allowed" }, 405);
  } catch (error) {
    console.log(JSON.stringify({ event: "crm_enquiry_sync_failed", error_type: error instanceof Error ? error.name : "UnknownError" }));
    return json({ error: "sync_failed" }, 500);
  }
}

export default async (request: Request, context: Context): Promise<Response> =>
  handleCrmEnquiries(request, context);

export const config: Config = {
  path: "/api/private-enquiries",
  method: ["GET", "DELETE"],
  rateLimit: {
    action: "rate_limit",
    aggregateBy: "ip",
    windowSize: 60,
    windowLimit: 30,
  },
};
