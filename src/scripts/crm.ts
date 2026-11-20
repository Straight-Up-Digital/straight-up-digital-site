interface ApiError { error?: string }
interface Contact {
  id: string;
  business_name: string;
  first_name: string;
  surname: string;
  email: string;
  phone: string;
  location: string;
  town: string;
  website_url: string;
  sector: string;
  pipeline_stage: string;
  source: string;
  notes: string;
  audit_score: number | null;
  audit_date: string;
  next_follow_up_date: string;
  quote_amount_cents: number | null;
  monthly_fee_cents: number | null;
  hosting_enabled: number;
  marketing_consent: number;
  consent_text_version?: string;
}
interface Activity {
  id: string;
  event_type: string;
  direction: string;
  summary: string;
  outcome: string;
  created_at: string;
}
interface ContactList { contacts: Contact[] }
interface ContactDetail { contact: Contact; activities: Activity[] }
interface Summary {
  stages: Array<{ stage: string; count: number }>;
  followUpsDue: number;
}

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required CRM element is missing: ${selector}`);
  return element;
}

const loginPanel = requiredElement<HTMLElement>("#login-panel");
const crmPanel = requiredElement<HTMLElement>("#crm-panel");
const loginStatus = requiredElement<HTMLElement>("#login-status");
const crmStatus = requiredElement<HTMLElement>("#crm-status");
const detailStatus = requiredElement<HTMLElement>("#detail-status");
const contactsEl = requiredElement<HTMLElement>("#contacts");
const summaryEl = requiredElement<HTMLElement>("#summary");
const contactForm = requiredElement<HTMLFormElement>("#contact-form");
const detailEmpty = requiredElement<HTMLElement>("#detail-empty");
const activityPanel = requiredElement<HTMLElement>("#activity-panel");
const activityForm = requiredElement<HTMLFormElement>("#activity-form");
const activitiesEl = requiredElement<HTMLElement>("#activities");
const searchInput = requiredElement<HTMLInputElement>("#search");
const stageFilter = requiredElement<HTMLSelectElement>("#stage-filter");
let selectedId = "";
let searchTimer: ReturnType<typeof setTimeout> | undefined;

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...options, credentials: "same-origin" });
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
      ? data.error
      : "Request failed.";
    throw new Error(message);
  }
  return data as T;
}

function setStatus(element: HTMLElement, message: string): void {
  element.textContent = message;
}

function stringFormData(form: HTMLFormElement): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of new FormData(form).entries()) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

function setFormValue(name: string, value: string): void {
  const field = contactForm.elements.namedItem(name);
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
    field.value = value;
  }
}

function renderSummary(data: Summary): void {
  const counts = new Map(data.stages.map((item) => [item.stage, item.count]));
  summaryEl.replaceChildren();
  for (const [label, value] of [
    ["New", counts.get("new") || 0],
    ["Contacted", counts.get("contacted") || 0],
    ["Quoted", counts.get("quoted") || 0],
    ["Follow-ups due", data.followUpsDue || 0],
  ] as const) {
    const card = document.createElement("div");
    card.className = "metric";
    const name = document.createElement("span");
    name.className = "muted";
    name.textContent = label;
    const number = document.createElement("strong");
    number.textContent = String(value);
    card.append(name, number);
    summaryEl.append(card);
  }
}

async function loadSummary(): Promise<void> {
  renderSummary(await api<Summary>("/api/crm/summary"));
}

async function loadContacts(): Promise<void> {
  const params = new URLSearchParams();
  const query = searchInput.value.trim();
  const stage = stageFilter.value;
  if (query) params.set("q", query);
  if (stage) params.set("stage", stage);
  const data = await api<ContactList>(`/api/crm/contacts?${params}`);
  contactsEl.replaceChildren();
  if (!data.contacts.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No matching contacts yet.";
    contactsEl.append(empty);
    return;
  }
  for (const contact of data.contacts) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "contact-item";
    button.setAttribute("aria-current", String(contact.id === selectedId));
    const name = document.createElement("strong");
    name.textContent = contact.business_name;
    const meta = document.createElement("span");
    meta.textContent = [contact.town, contact.email, contact.pipeline_stage].filter(Boolean).join(" · ");
    button.append(name, meta);
    button.addEventListener("click", () => void selectContact(contact.id));
    contactsEl.append(button);
  }
}

function populateContact(contact: Contact): void {
  const values: Record<string, string> = {
    businessName: contact.business_name,
    firstName: contact.first_name,
    surname: contact.surname,
    email: contact.email,
    phone: contact.phone,
    location: contact.location,
    town: contact.town,
    sector: contact.sector,
    websiteUrl: contact.website_url,
    pipelineStage: contact.pipeline_stage,
    nextFollowUpDate: contact.next_follow_up_date,
    notes: contact.notes,
    consentTextVersion: contact.consent_text_version || "",
  };
  for (const [name, value] of Object.entries(values)) setFormValue(name, value || "");
  requiredElement<HTMLInputElement>("#marketing-consent").checked = Boolean(contact.marketing_consent);
}

function renderActivities(items: Activity[]): void {
  activitiesEl.replaceChildren();
  for (const item of items) {
    const article = document.createElement("article");
    article.className = "activity";
    const heading = document.createElement("strong");
    heading.textContent = `${item.event_type} · ${item.direction}`;
    const summary = document.createElement("p");
    summary.textContent = item.summary;
    const time = document.createElement("time");
    time.dateTime = item.created_at;
    time.textContent = new Date(item.created_at).toLocaleString();
    article.append(heading, summary, time);
    if (item.outcome) {
      const outcome = document.createElement("p");
      outcome.className = "muted";
      outcome.textContent = `Outcome: ${item.outcome}`;
      article.append(outcome);
    }
    activitiesEl.append(article);
  }
}

async function selectContact(id: string): Promise<void> {
  const data = await api<ContactDetail>(`/api/crm/contacts/${id}`);
  selectedId = id;
  contactForm.hidden = false;
  detailEmpty.hidden = true;
  activityPanel.hidden = false;
  populateContact(data.contact);
  renderActivities(data.activities);
  await loadContacts();
}

async function refresh(): Promise<void> {
  await Promise.all([loadSummary(), loadContacts()]);
}

async function updateSession(): Promise<void> {
  const data = await api<{ authenticated: boolean }>("/api/crm/session");
  loginPanel.hidden = data.authenticated;
  crmPanel.hidden = !data.authenticated;
  if (data.authenticated) {
    try {
      await refresh();
    } catch {
      setStatus(crmStatus, "The CRM data service is not available. Try again later.");
    }
  }
}

requiredElement<HTMLFormElement>("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(loginStatus, "");
  const passwordInput = requiredElement<HTMLInputElement>("#password");
  try {
    await api("/api/crm/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: passwordInput.value }),
    });
    passwordInput.value = "";
    await updateSession();
  } catch {
    setStatus(loginStatus, "Sign-in failed or CRM access is not configured. Check your password or contact the owner.");
  }
});

requiredElement<HTMLButtonElement>("#logout").addEventListener("click", async () => {
  try {
    await api("/api/crm/logout", { method: "POST" });
  } finally {
    location.reload();
  }
});

requiredElement<HTMLButtonElement>("#new-contact").addEventListener("click", () => {
  selectedId = "";
  contactForm.reset();
  contactForm.hidden = false;
  detailEmpty.hidden = true;
  activityPanel.hidden = true;
  setStatus(detailStatus, "Add a new contact. Marketing permission is optional and starts off.");
});

requiredElement<HTMLButtonElement>("#cancel-contact").addEventListener("click", () => {
  contactForm.hidden = true;
  detailEmpty.hidden = false;
  activityPanel.hidden = true;
  selectedId = "";
  setStatus(detailStatus, "");
});

contactForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = stringFormData(contactForm);
  const marketingConsent = requiredElement<HTMLInputElement>("#marketing-consent").checked;
  try {
    if (selectedId) {
      await api(`/api/crm/contacts/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, marketingConsent }),
      });
      setStatus(detailStatus, "Contact saved.");
      await selectContact(selectedId);
    } else {
      const result = await api<{ id: string }>("/api/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, marketingConsent }),
      });
      setStatus(detailStatus, "Contact created.");
      await refresh();
      await selectContact(result.id);
    }
  } catch {
    setStatus(detailStatus, "Could not save this contact. Check the fields and try again.");
  }
});

activityForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedId) return;
  const values = stringFormData(activityForm);
  try {
    await api(`/api/crm/contacts/${selectedId}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    activityForm.reset();
    await selectContact(selectedId);
    setStatus(detailStatus, "Activity added.");
  } catch {
    setStatus(detailStatus, "Could not add that activity. Try again.");
  }
});

searchInput.addEventListener("input", () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    void loadContacts().catch(() => setStatus(crmStatus, "Could not load contacts."));
  }, 180);
});
stageFilter.addEventListener("change", () => {
  void loadContacts().catch(() => setStatus(crmStatus, "Could not load contacts."));
});

void updateSession().catch(() => setStatus(loginStatus, "The CRM service is temporarily unavailable."));
