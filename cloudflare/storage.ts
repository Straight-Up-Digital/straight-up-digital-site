import type { CleanEnquiry } from "../netlify/lib/validation.mts";
import type { CustomerReport } from "../netlify/lib/client-report.mts";
import type { D1DatabaseLike, IntakeFields, StoredEnquiry, StoredReport } from "./types.ts";

const INTAKE_FIELDS: (keyof IntakeFields)[] = [
  "name", "businessName", "websiteUrl", "email", "phone", "service", "message",
  "consentGiven", "consentTextVersion", "consentTimestamp", "formType", "source",
];

export interface EnquiryPage {
  items: StoredEnquiry[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PrivateDataStore {
  saveDeliveredEnquiry(enquiry: CleanEnquiry, receivedAt: string, id: string): Promise<void>;
  listEnquiries(cursor: [string, string] | null, pageSize: number): Promise<EnquiryPage>;
  deleteEnquiries(ids: string[]): Promise<number>;
  createReport(key: string, report: CustomerReport, expiresAt: string, createdAt: string): Promise<boolean>;
  getReport(key: string): Promise<StoredReport | null>;
  deleteReport(key: string): Promise<boolean>;
  deleteExpiredReports(now: string): Promise<number>;
  incrementRateLimit(key: string, windowStart: number, expiresAt: number): Promise<number>;
  deleteExpiredRateLimits(now: number): Promise<number>;
}

const encodeCursor = (record: StoredEnquiry): string =>
  Buffer.from(JSON.stringify([record.receivedAt, record.id]), "utf8").toString("base64url");

const toFields = (enquiry: CleanEnquiry): IntakeFields => {
  const source = enquiry as unknown as Record<string, unknown>;
  const fields: Record<string, unknown> = {};
  for (const key of INTAKE_FIELDS) {
    const sourceKey = key === "businessName" ? "businessName" : key;
    fields[key] = source[sourceKey];
  }
  return fields as unknown as IntakeFields;
};

export class D1DataStore implements PrivateDataStore {
  private readonly db: D1DatabaseLike;
  constructor(db: D1DatabaseLike) { this.db = db; }

  async saveDeliveredEnquiry(enquiry: CleanEnquiry, receivedAt: string, id: string): Promise<void> {
    const fields = toFields(enquiry);
    await this.db.prepare(
      "INSERT INTO website_enquiries (id, received_at, fields_json) VALUES (?, ?, ?)",
    ).bind(id, receivedAt, JSON.stringify(fields)).run();
  }

  async listEnquiries(cursor: [string, string] | null, pageSize: number): Promise<EnquiryPage> {
    const limit = Math.max(1, Math.min(100, Math.floor(pageSize)));
    const statement = cursor
      ? this.db.prepare("SELECT id, received_at, fields_json FROM website_enquiries WHERE received_at > ? OR (received_at = ? AND id > ?) ORDER BY received_at ASC, id ASC LIMIT ?").bind(cursor[0], cursor[0], cursor[1], limit + 1)
      : this.db.prepare("SELECT id, received_at, fields_json FROM website_enquiries ORDER BY received_at ASC, id ASC LIMIT ?").bind(limit + 1);
    const result = await statement.all<{ id: string; received_at: string; fields_json: string }>();
    const rows = result.results ?? [];
    const hasMore = rows.length > limit;
    const selected = rows.slice(0, limit);
    const items: StoredEnquiry[] = [];
    for (const row of selected) {
      try {
        const fields = JSON.parse(row.fields_json) as IntakeFields;
        if (!row.id || !row.received_at || !fields || typeof fields !== "object") continue;
        items.push({ id: row.id, receivedAt: row.received_at, fields });
      } catch {
        // Ignore a corrupt record; never return a raw or partially parsed row.
      }
    }
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: last ? encodeCursor(last) : null,
      hasMore,
    };
  }

  async deleteEnquiries(ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    const placeholders = ids.map(() => "?").join(", ");
    const result = await this.db.prepare(`DELETE FROM website_enquiries WHERE id IN (${placeholders})`).bind(...ids).run();
    return result.meta?.changes ?? 0;
  }

  async createReport(key: string, report: CustomerReport, expiresAt: string, createdAt: string): Promise<boolean> {
    const result = await this.db.prepare(
      "INSERT OR IGNORE INTO client_audit_reports (token_key, report_json, created_at, expires_at) VALUES (?, ?, ?, ?)",
    ).bind(key, JSON.stringify(report), createdAt, expiresAt).run();
    return (result.meta?.changes ?? 0) === 1;
  }

  async getReport(key: string): Promise<StoredReport | null> {
    const row = await this.db.prepare(
      "SELECT report_json, expires_at FROM client_audit_reports WHERE token_key = ?",
    ).bind(key).first<{ report_json: string; expires_at: string }>();
    if (!row) return null;
    try {
      return { report: JSON.parse(row.report_json) as CustomerReport, expiresAt: row.expires_at };
    } catch {
      return null;
    }
  }

  async deleteReport(key: string): Promise<boolean> {
    const result = await this.db.prepare(
      "DELETE FROM client_audit_reports WHERE token_key = ?",
    ).bind(key).run();
    return (result.meta?.changes ?? 0) > 0;
  }

  async deleteExpiredReports(now: string): Promise<number> {
    const result = await this.db.prepare(
      "DELETE FROM client_audit_reports WHERE expires_at <= ?",
    ).bind(now).run();
    return result.meta?.changes ?? 0;
  }

  async incrementRateLimit(key: string, windowStart: number, expiresAt: number): Promise<number> {
    const row = await this.db.prepare(
      "INSERT INTO request_rate_limits (bucket_key, window_start, count, expires_at) VALUES (?, ?, 1, ?) ON CONFLICT(bucket_key, window_start) DO UPDATE SET count = count + 1 RETURNING count",
    ).bind(key, windowStart, expiresAt).first<{ count: number }>();
    return Number(row?.count ?? 0);
  }

  async deleteExpiredRateLimits(now: number): Promise<number> {
    const result = await this.db.prepare(
      "DELETE FROM request_rate_limits WHERE expires_at <= ?",
    ).bind(now).run();
    return result.meta?.changes ?? 0;
  }
}

export const hashRateKey = async (secret: string, route: string, ip: string): Promise<string> => {
  const bytes = new TextEncoder().encode(`${secret}\u0000${route}\u0000${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const decodeCursor = (value: string): [string, string] | null => {
  if (!value || value.length > 512) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    if (Array.isArray(parsed) && typeof parsed[0] === "string" && typeof parsed[1] === "string") {
      const receivedAt = Date.parse(parsed[0]);
      if (Number.isFinite(receivedAt) && parsed[1].length <= 80) return [parsed[0], parsed[1]];
    }
  } catch {
    // Invalid cursors are reported to the caller, not interpreted as the first page.
  }
  return null;
};

export const createReportKey = async (token: string): Promise<string> => `reports/${await sha256Hex(token)}`;

export const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};
