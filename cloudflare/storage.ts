import type { CleanEnquiry } from "../netlify/lib/validation.mts";
import type { CustomerReport } from "../netlify/lib/client-report.mts";
import { FirestoreError, firestoreClientFromEnv, type FirestoreClientOptions, type FirestoreDocument, type FirestoreValue } from "./firestore.ts";
import type { CloudflareWorkerEnv, IntakeFields, StoredEnquiry, StoredReport } from "./types.ts";

const ENQUIRY_COLLECTION = "website_enquiries";
const REPORT_COLLECTION = "client_audit_reports";
const RATE_COLLECTION = "request_rate_limits";
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
  for (const key of INTAKE_FIELDS) fields[key] = source[key];
  return fields as unknown as IntakeFields;
};

const stringField = (document: FirestoreDocument, field: string): string | null => {
  const value = document.fields?.[field]?.stringValue;
  return typeof value === "string" ? value : null;
};

const integerField = (document: FirestoreDocument, field: string): number | null => {
  const value = document.fields?.[field]?.integerValue;
  if (typeof value !== "string" || !/^-?\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const reportIdFromKey = (key: string): string | null => {
  const match = /^reports\/([a-f0-9]{64})$/.exec(key);
  return match?.[1] ?? null;
};

const queryDocuments = async (
  store: FirestoreRestClientLike,
  collection: string,
  orderField: string,
  value: FirestoreValue,
  limit: number,
): Promise<FirestoreDocument[]> => store.runQuery({
  from: [{ collectionId: collection }],
  where: { fieldFilter: { field: { fieldPath: orderField }, op: "LESS_THAN_OR_EQUAL", value } },
  orderBy: [{ field: { fieldPath: orderField }, direction: "ASCENDING" }],
  limit,
});

interface FirestoreRestClientLike {
  documentName(collection: string, id: string): string;
  getDocument(collection: string, id: string): Promise<FirestoreDocument | null>;
  patchDocument(collection: string, id: string, fields: Record<string, FirestoreValue>, exists?: boolean): Promise<FirestoreDocument>;
  deleteDocument(collection: string, id: string): Promise<boolean>;
  runQuery(structuredQuery: Record<string, unknown>): Promise<FirestoreDocument[]>;
  commit(writes: unknown[]): Promise<void>;
}

export class FirestoreDataStore implements PrivateDataStore {
  private readonly env: Pick<CloudflareWorkerEnv, "FIRESTORE_PROJECT_ID" | "GOOGLE_FIRESTORE_SERVICE_ACCOUNT_JSON">;
  private readonly options: FirestoreClientOptions;
  private firestore: FirestoreRestClientLike | null = null;

  constructor(
    env: Pick<CloudflareWorkerEnv, "FIRESTORE_PROJECT_ID" | "GOOGLE_FIRESTORE_SERVICE_ACCOUNT_JSON">,
    options: FirestoreClientOptions = {},
  ) {
    this.env = env;
    this.options = options;
  }

  private client(): FirestoreRestClientLike {
    if (!this.firestore) this.firestore = firestoreClientFromEnv(this.env, this.options);
    return this.firestore;
  }

  async saveDeliveredEnquiry(enquiry: CleanEnquiry, receivedAt: string, id: string): Promise<void> {
    const fields = toFields(enquiry);
    await this.client().patchDocument(ENQUIRY_COLLECTION, id, {
      id: { stringValue: id },
      receivedAt: { stringValue: receivedAt },
      sortKey: { stringValue: `${receivedAt}|${id}` },
      fieldsJson: { stringValue: JSON.stringify(fields) },
    }, false);
  }

  async listEnquiries(cursor: [string, string] | null, pageSize: number): Promise<EnquiryPage> {
    const limit = Math.max(1, Math.min(100, Math.floor(pageSize)));
    const structuredQuery: Record<string, unknown> = {
      from: [{ collectionId: ENQUIRY_COLLECTION }],
      orderBy: [{ field: { fieldPath: "sortKey" }, direction: "ASCENDING" }],
      limit: limit + 1,
    };
    if (cursor) {
      structuredQuery.startAt = {
        values: [{ stringValue: `${cursor[0]}|${cursor[1]}` }],
        inclusive: false,
      };
    }
    const documents = await this.client().runQuery(structuredQuery);
    const hasMore = documents.length > limit;
    const selected = documents.slice(0, limit);
    const items: StoredEnquiry[] = [];
    for (const document of selected) {
      try {
        const id = stringField(document, "id");
        const receivedAt = stringField(document, "receivedAt");
        const rawFields = stringField(document, "fieldsJson");
        if (!id || !receivedAt || !rawFields) continue;
        const fields = JSON.parse(rawFields) as IntakeFields;
        if (!fields || typeof fields !== "object" || Array.isArray(fields)) continue;
        items.push({ id, receivedAt, fields });
      } catch {
        // Ignore corrupt records; never return a raw or partially parsed document.
      }
    }
    const last = items[items.length - 1];
    return { items, nextCursor: last ? encodeCursor(last) : null, hasMore };
  }

  async deleteEnquiries(ids: string[]): Promise<number> {
    const uniqueIds = [...new Set(ids)].filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    if (!uniqueIds.length) return 0;
    const client = this.client();
    await client.commit(uniqueIds.map((id) => ({ delete: client.documentName(ENQUIRY_COLLECTION, id) })));
    return uniqueIds.length;
  }

  async createReport(key: string, report: CustomerReport, expiresAt: string, createdAt: string): Promise<boolean> {
    const id = reportIdFromKey(key);
    if (!id) throw new FirestoreError(0, "configuration");
    try {
      await this.client().patchDocument(REPORT_COLLECTION, id, {
        reportJson: { stringValue: JSON.stringify(report) },
        createdAt: { stringValue: createdAt },
        expiresAt: { stringValue: expiresAt },
      }, false);
      return true;
    } catch (error) {
      const existing = await this.client().getDocument(REPORT_COLLECTION, id);
      if (existing) return false;
      throw error;
    }
  }

  async getReport(key: string): Promise<StoredReport | null> {
    const id = reportIdFromKey(key);
    if (!id) return null;
    const document = await this.client().getDocument(REPORT_COLLECTION, id);
    if (!document) return null;
    const reportJson = stringField(document, "reportJson");
    const expiresAt = stringField(document, "expiresAt");
    if (!reportJson || !expiresAt) return null;
    try { return { report: JSON.parse(reportJson) as CustomerReport, expiresAt }; } catch { return null; }
  }

  async deleteReport(key: string): Promise<boolean> {
    const id = reportIdFromKey(key);
    if (!id) return false;
    return this.client().deleteDocument(REPORT_COLLECTION, id);
  }

  async deleteExpiredReports(now: string): Promise<number> {
    return this.deleteExpired(REPORT_COLLECTION, "expiresAt", { stringValue: now });
  }

  async incrementRateLimit(key: string, windowStart: number, expiresAt: number): Promise<number> {
    if (!/^[a-f0-9]{64}$/.test(key) || !Number.isSafeInteger(windowStart) || windowStart < 0 || !Number.isSafeInteger(expiresAt) || expiresAt < 0) {
      throw new FirestoreError(0, "configuration");
    }
    const client = this.client();
    const id = `rate_${key}_${windowStart}`;
    let current = await client.getDocument(RATE_COLLECTION, id);
    if (!current) {
      try {
        await client.patchDocument(RATE_COLLECTION, id, {
          count: { integerValue: "1" },
          windowStart: { integerValue: String(windowStart) },
          expiresAt: { integerValue: String(expiresAt) },
        }, false);
        return 1;
      } catch (error) {
        current = await client.getDocument(RATE_COLLECTION, id);
        if (!current) throw error;
        // A concurrent first request created the bucket; count this request atomically below.
      }
    }
    await client.commit([{
      transform: {
        document: client.documentName(RATE_COLLECTION, id),
        fieldTransforms: [{ fieldPath: "count", increment: { integerValue: "1" } }],
      },
    }]);
    const updated = await client.getDocument(RATE_COLLECTION, id);
    const count = updated ? integerField(updated, "count") : null;
    if (count === null) throw new FirestoreError(0, "read");
    return count;
  }

  async deleteExpiredRateLimits(now: number): Promise<number> {
    if (!Number.isSafeInteger(now) || now < 0) throw new FirestoreError(0, "configuration");
    return this.deleteExpired(RATE_COLLECTION, "expiresAt", { integerValue: String(now) });
  }

  private async deleteExpired(collection: string, field: string, value: FirestoreValue): Promise<number> {
    const documents = await queryDocuments(this.client(), collection, field, value, 450);
    if (!documents.length) return 0;
    const names = documents.map((document) => document.name).filter((name): name is string => typeof name === "string");
    if (!names.length) return 0;
    await this.client().commit(names.map((name) => ({ delete: name })));
    return names.length;
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
