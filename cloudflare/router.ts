import { FirestoreDataStore } from "./storage.ts";
import { handleSubmitEnquiry, handleClientReport } from "./public-routes.ts";
import { handleCrmEnquiries, handlePublishReport } from "./private-routes.ts";
import { sendEnquiryEmail, sendReportResponseEmail } from "./email.ts";
import type { CloudflareWorkerEnv, SocketConnect, WorkerExecutionContext } from "./types.ts";

export async function handleWorkerRequest(request: Request, env: CloudflareWorkerEnv, _ctx?: WorkerExecutionContext, socketConnect?: SocketConnect): Promise<Response> {
  const url = new URL(request.url);
  const store = new FirestoreDataStore(env);
  const publicDeps = {
    store,
    sendEnquiryEmail: (enquiry: Parameters<typeof sendEnquiryEmail>[0], mailEnv: CloudflareWorkerEnv) => sendEnquiryEmail(enquiry, mailEnv, socketConnect),
    sendReportResponseEmail: (input: Parameters<typeof sendReportResponseEmail>[0], mailEnv: CloudflareWorkerEnv) => sendReportResponseEmail(input, mailEnv, socketConnect),
  };
  const privateDeps = { store };

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
