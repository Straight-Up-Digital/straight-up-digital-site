import { randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";
import type { Context } from "@netlify/functions";
import type { CleanEnquiry } from "./validation.mts";

export const CRM_ENQUIRY_STORE = "straight-up-digital-crm-enquiries";

export interface StoredEnquiry {
  id: string;
  receivedAt: string;
  fields: Pick<
    CleanEnquiry,
    | "name"
    | "businessName"
    | "websiteUrl"
    | "email"
    | "phone"
    | "service"
    | "message"
    | "consentGiven"
    | "consentTextVersion"
    | "consentTimestamp"
    | "formType"
    | "source"
  >;
}

/** Store one email-delivered enquiry privately until the owner imports it into the local CRM. */
export async function storeDeliveredEnquiry(
  enquiry: CleanEnquiry,
  context: Context,
): Promise<string> {
  if (context.deploy?.context !== "production") {
    throw new Error("production_context_required");
  }
  const id = randomUUID();
  const record: StoredEnquiry = {
    id,
    receivedAt: new Date().toISOString(),
    fields: {
      name: enquiry.name,
      businessName: enquiry.businessName,
      websiteUrl: enquiry.websiteUrl,
      email: enquiry.email,
      phone: enquiry.phone,
      service: enquiry.service,
      message: enquiry.message,
      consentGiven: enquiry.consentGiven,
      consentTextVersion: enquiry.consentTextVersion,
      consentTimestamp: enquiry.consentTimestamp,
      formType: enquiry.formType,
      source: enquiry.source,
    },
  };
  const store = getStore({ name: CRM_ENQUIRY_STORE, consistency: "strong" });
  await store.setJSON(id, record, { onlyIfNew: true });
  return id;
}
