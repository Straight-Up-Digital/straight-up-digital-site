import type { CleanEnquiry } from "../shared/validation.mts";
import type { CustomerReport } from "../shared/client-report.mts";

export interface StaticAssetBinding { fetch(request: Request): Promise<Response> }
export interface TcpSocketLike {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  opened?: Promise<unknown>;
  startTls(): TcpSocketLike;
  close(): Promise<void>;
}
export type SocketConnect = (
  address: { hostname: string; port: number },
  options?: { secureTransport?: "off" | "on" | "starttls"; allowHalfOpen?: boolean },
) => TcpSocketLike;

export interface IntakeFields {
  name: string; businessName: string; websiteUrl: string; email: string; phone: string;
  service: string; message: string; consentGiven: true; consentTextVersion: string;
  consentTimestamp: string; formType: "audit" | "contact"; source: string;
}
export interface StoredEnquiry { id: string; receivedAt: string; fields: IntakeFields }
export interface StoredReport { report: CustomerReport; expiresAt: string }

export interface CloudflareWorkerEnv {
  ASSETS: StaticAssetBinding;
  FIRESTORE_PROJECT_ID?: string;
  GOOGLE_FIRESTORE_SERVICE_ACCOUNT_JSON?: string;
  APP_ENV?: string;
  PUBLIC_REPORT_HOSTS?: string;
  EMAIL_PROVIDER?: string;
  ENQUIRY_TO_EMAIL?: string;
  ENQUIRY_FROM_EMAIL?: string;
  ZOHO_SMTP_HOST?: string;
  ZOHO_SMTP_PORT?: string;
  ZOHO_SMTP_USERNAME?: string;
  ZOHO_SMTP_PASSWORD?: string;
  ZOHO_SMTP_SECURE?: string;
  ZOHO_API_CLIENT_ID?: string;
  ZOHO_API_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  POSTMARK_SERVER_TOKEN?: string;
  POSTMARK_MESSAGE_STREAM?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  CRM_ENQUIRY_SYNC_TOKEN?: string;
  AUDIT_REPORTS_ENABLED?: string;
  AUDIT_REPORT_PUBLISH_TOKEN?: string;
  RATE_LIMIT_HASH_SECRET?: string;
}

export type EnquiryEmailSender = (enquiry: CleanEnquiry, env: CloudflareWorkerEnv, connect?: SocketConnect) => Promise<{ provider: string }>;
export type ReportEmailSender = (input: {
  businessName: string; website: string; clientName: string; clientEmail: string;
  action: "proceed" | "meeting" | "question"; meetingWindow: string; message: string;
  reportDate: string; consentTimestamp: string; consentTextVersion: string;
}, env: CloudflareWorkerEnv, connect?: SocketConnect) => Promise<{ provider: string }>;
export interface WorkerExecutionContext { waitUntil(promise: Promise<unknown>): void; passThroughOnException?(): void }
