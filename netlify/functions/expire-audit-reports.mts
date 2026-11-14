import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { REPORT_KEY_PREFIX, REPORT_STORE } from "../lib/client-report.mts";

export default async (): Promise<void> => {
  const store = getStore({ name: REPORT_STORE, consistency: "strong" });
  const now = Date.now();
  let deleted = 0;
  for await (const page of store.list({ paginate: true, prefix: REPORT_KEY_PREFIX })) {
    for (const blob of page.blobs) {
      const record = await store.get(blob.key, { type: "json", consistency: "strong" }) as { expiresAt?: unknown } | null;
      if (record && typeof record.expiresAt === "string") {
        const expiresAt = Date.parse(record.expiresAt);
        if (Number.isFinite(expiresAt) && expiresAt <= now) {
          await store.delete(blob.key);
          deleted += 1;
        }
      }
    }
  }
  console.log(JSON.stringify({ event: "client_report_cleanup", expired_reports_deleted: deleted }));
};

export const config: Config = { schedule: "15 2 * * *" };
