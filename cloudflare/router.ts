import { FirestoreDataStore } from "./storage.ts";
import { handleSubmitEnquiry, handleClientReport } from "./public-routes.ts";
import { handleCrmEnquiries, handlePublishReport } from "./private-routes.ts";
import { sendEnquiryEmail, sendReportResponseEmail } from "./email.ts";
import type { CloudflareWorkerEnv, SocketConnect, WorkerExecutionContext } from "./types.ts";
import { handlePaystackCallback, handlePaystackInitialize, handlePaystackWebhook } from "./paystack.ts";
import { FirestorePaystackOrderStore } from "./paystack-store.ts";

export async function handleWorkerRequest(request: Request, env: CloudflareWorkerEnv, _ctx?: WorkerExecutionContext, socketConnect?: SocketConnect): Promise<Response> {
  const url = new URL(request.url);
  const store = new FirestoreDataStore(env);
  const publicDeps = {
    store,
    sendEnquiryEmail: (enquiry: Parameters<typeof sendEnquiryEmail>[0], mailEnv: CloudflareWorkerEnv) => sendEnquiryEmail(enquiry, mailEnv, socketConnect),
    sendReportResponseEmail: (input: Parameters<typeof sendReportResponseEmail>[0], mailEnv: CloudflareWorkerEnv) => sendReportResponseEmail(input, mailEnv, socketConnect),
  };
  const privateDeps = { store };

  if (url.pathname === "/api/paystack/initialize") {
    const paymentDeps = { store: env.APP_ENV === "test" ? new FirestorePaystackOrderStore(env) : undefined };
    return handlePaystackInitialize(request, env, paymentDeps);
  }
  if (url.pathname === "/api/paystack/callback") {
    const paymentDeps = { store: env.APP_ENV === "test" ? new FirestorePaystackOrderStore(env) : undefined };
    return handlePaystackCallback(request, env, paymentDeps);
  }
  if (url.pathname === "/api/paystack/webhook") {
    const paymentDeps = { store: env.APP_ENV === "test" ? new FirestorePaystackOrderStore(env) : undefined };
    return handlePaystackWebhook(request, env, paymentDeps);
  }

  if (url.pathname === "/api/enquiries") {
    return handleSubmitEnquiry(request, env, publicDeps);
  }
  if (url.pathname === "/api/publish-audit-report") {
    return handlePublishReport(request, env, privateDeps);
  }
  if (url.pathname === "/api/private-enquiries") {
    return handleCrmEnquiries(request, env, privateDeps);
  }
  const reportMatch = /^\/report\/([A-Za-z0-9_-]{1,100})$/.exec(url.pathname);
  if (reportMatch) return handleClientReport(request, reportMatch[1], env, publicDeps);

  return env.ASSETS.fetch(request);
}
