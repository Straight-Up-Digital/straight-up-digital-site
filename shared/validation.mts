/**
 * Server-side validation for the enquiry function.
 *
 * The client validates first for a fast, accessible experience. This module is
 * the authority: nothing reaches the email adapter or the (disabled) CRM hook
 * unless it passes here.
 */

export interface RawEnquiry {
  name?: unknown;
  business_name?: unknown;
  website_url?: unknown;
  email?: unknown;
  phone?: unknown;
  service_of_interest?: unknown;
  message?: unknown;
  consent_given?: unknown;
  consent_text_version?: unknown;
  consent_timestamp?: unknown;
  form_type?: unknown;
  source?: unknown;
  website_url_confirm?: unknown;
  company_website_confirm?: unknown;
  started_at?: unknown;
  turnstile_token?: unknown;
}

export interface CleanEnquiry {
  name: string;
  businessName: string;
  websiteUrl: string;
  email: string;
  phone: string;
  service: string;
  message: string;
  consentGiven: true;
  consentTextVersion: string;
  consentTimestamp: string;
  formType: "audit" | "contact";
  source: string;
  turnstileToken: string;
  startedAt: number;
}

export type ValidationResult =
  | { ok: true; value: CleanEnquiry }
  | { ok: false; errors: Record<string, string> };

const MAX = {
  name: 120,
  business: 120,
  website: 300,
  email: 200,
  phone: 40,
  service: 120,
  message: 2000,
  source: 200,
};

const asString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const normalizeUrl = (value: string): string =>
  /^https?:\/\//i.test(value) ? value : `https://${value}`;

const isEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value);

const isWebsite = (value: string): boolean => {
  try {
    const url = new URL(normalizeUrl(value));
    const host = url.hostname;
    return (
      host.includes(".") &&
      !host.startsWith(".") &&
      !host.endsWith(".") &&
      host.length <= 253
    );
  } catch {
    return false;
  }
};

const asBoolean = (value: unknown): boolean =>
  value === true || value === "true" || value === "yes" || value === "on";

export function validateEnquiry(raw: RawEnquiry): ValidationResult {
  const errors: Record<string, string> = {};

  const name = asString(raw.name);
  const business = asString(raw.business_name);
  const website = asString(raw.website_url);
  const message = asString(raw.message);
  const email = asString(raw.email).toLowerCase();
  const phone = asString(raw.phone);
  const service = asString(raw.service_of_interest);
  const formType = asString(raw.form_type) === "audit" ? "audit" : "contact";
  const source = asString(raw.source) || "/";
  const consentGiven = asBoolean(raw.consent_given);
  const consentTextVersion = asString(raw.consent_text_version) || "unknown";
  const consentTimestampRaw = asString(raw.consent_timestamp);
  const startedAtRaw = Number(asString(raw.started_at));
  const turnstileToken = asString(raw.turnstile_token);

  if (name.length > MAX.name) errors.name = "Name is too long.";
  if (formType === "contact" && name.length < 2) {
    errors.name = "Enter a name so we know who we are replying to.";
  }

  if (business.length < 2) errors.business_name = "Enter the business name.";
  if (business.length > MAX.business) errors.business_name = "Business name is too long.";

  if (website.length === 0) {
    if (formType === "audit" && message.length === 0) {
      errors.website_url =
        "Add the website address, or say in the message that there is no site yet.";
    }
  } else if (website.length > MAX.website || !isWebsite(website)) {
    errors.website_url = "Enter a valid website address, for example yourbusiness.co.za.";
  }

  if (!email) errors.email = "Enter an email address so we can reply.";
  else if (email.length > MAX.email || !isEmail(email)) {
    errors.email = "That email address does not look right.";
  }

  const phoneDigits = phone.replace(/\D/g, "");
  if (phone.length > MAX.phone || (phone.length > 0 && phoneDigits.length < 7)) {
    errors.phone = "Check the phone number, or leave it empty.";
  }

  if (!service) errors.service_of_interest = "Choose a service of interest.";
  if (service.length > MAX.service) {
    errors.service_of_interest = "Service of interest is too long.";
  }

  if (formType === "contact" && message.length < 10) {
    errors.message = "Tell us a little about what you need.";
  }
  if (message.length > MAX.message) errors.message = "Message is too long.";

  if (!consentGiven) {
    errors.consent_given = "Confirm you agree to the privacy notice.";
  }

  const consentTimestamp =
    consentTimestampRaw && !Number.isNaN(Date.parse(consentTimestampRaw))
      ? new Date(consentTimestampRaw).toISOString()
      : new Date().toISOString();

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      name,
      businessName: business,
      websiteUrl: website ? normalizeUrl(website) : "",
      email,
      phone,
      service,
      message,
      consentGiven: true,
      consentTextVersion,
      consentTimestamp,
      formType,
      source: source.slice(0, MAX.source),
      turnstileToken,
      startedAt: Number.isFinite(startedAtRaw) ? startedAtRaw : 0,
    },
  };
}

/** A filled honeypot is treated as a spam signal, never as a validation error. */
export function isHoneypotFilled(raw: RawEnquiry): boolean {
  return Boolean(asString(raw.company_website_confirm) || asString(raw.website_url_confirm));
}

/**
 * A human cannot fill the form in under three seconds. Bots can. Submissions
 * that arrive faster are acknowledged but never delivered.
 */
export function isImplausiblyFast(value: CleanEnquiry): boolean {
  if (!value.startedAt || value.startedAt <= 0) return false;
  const elapsed = Date.now() - value.startedAt;
  return elapsed >= 0 && elapsed < 3000;
}
