/**
 * DISABLED integration point for the private Python CRM.
 *
 * Phase 1 (now): nothing here is called. No CRM URL, token or network request
 * exists in this repository. The private Business Auditor and CRM stay on their
 * own host and are never exposed to the browser.
 *
 * Phase 2 (later, after the Python side has login, a production database and a
 * narrow intake endpoint): implement `forwardLead` with the shared secret held
 * in a Netlify environment variable, set CRM_ENABLED=true, and call it from the
 * function after a successful email send. Leads must arrive marked unverified
 * with outreach switched off, exactly as the Not listed finder does.
 *
 * The payload shape below is the contract. Keep it stable.
 */
import type { CleanEnquiry } from "./validation.mts";

export const CRM_ENABLED = false;

export interface CrmLeadPayload {
  business_name: string;
  website_url: string;
  email: string;
  phone: string;
  service_of_interest: string;
  message: string;
  consent_given: true;
  consent_text_version: string;
  consent_timestamp: string;
  source: string;
}

export function toCrmLeadPayload(enquiry: CleanEnquiry): CrmLeadPayload {
  return {
    business_name: enquiry.businessName,
    website_url: enquiry.websiteUrl,
    email: enquiry.email,
    phone: enquiry.phone,
    service_of_interest: enquiry.service,
    message: enquiry.message,
    consent_given: true,
    consent_text_version: enquiry.consentTextVersion,
    consent_timestamp: enquiry.consentTimestamp,
    source: enquiry.source,
  };
}

export async function forwardLead(_payload: CrmLeadPayload): Promise<void> {
  throw new Error(
    "CRM forwarding is disabled. Implement the phase 2 intake endpoint before enabling.",
  );
}
