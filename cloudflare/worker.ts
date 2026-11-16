/// <reference types="@cloudflare/workers-types" />
import { connect } from "cloudflare:sockets";
import { handleWorkerRequest } from "./router.ts";
import { D1DataStore } from "./storage.ts";
import { runDailyCleanup } from "./scheduled.ts";
import type { CloudflareWorkerEnv, SocketConnect, WorkerExecutionContext } from "./types.ts";

interface CronController { cron: string; scheduledTime: number }

export default {
  fetch(request: Request, env: CloudflareWorkerEnv, ctx: WorkerExecutionContext): Promise<Response> {
    return handleWorkerRequest(request, env, ctx, connect as unknown as SocketConnect);
  },
  scheduled(_controller: CronController, env: CloudflareWorkerEnv, ctx: WorkerExecutionContext): void {
    ctx.waitUntil((async () => {
      const now = Date.now();
      try {
        const store = new D1DataStore(env.DB);
        await runDailyCleanup(store, now);
      } catch (error) {
        console.log(JSON.stringify({ event: "client_report_cleanup_failed", error_type: error instanceof Error ? error.name : "UnknownError" }));
        throw error;
      }
    })());
  },
} satisfies ExportedHandler<CloudflareWorkerEnv>;
