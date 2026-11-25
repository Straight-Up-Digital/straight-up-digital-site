import type { PrivateDataStore } from "./storage.ts";

export async function runDailyCleanup(store: PrivateDataStore, now = Date.now()): Promise<{ reportsDeleted: number; rateLimitBucketsDeleted: number }> {
  const reportsDeleted = await store.deleteExpiredReports(new Date(now).toISOString());
  const rateLimitBucketsDeleted = await store.deleteExpiredRateLimits(now);
  console.log(JSON.stringify({ event: "client_report_cleanup", expired_reports_deleted: reportsDeleted, expired_rate_limit_buckets_deleted: rateLimitBucketsDeleted }));
  return { reportsDeleted, rateLimitBucketsDeleted };
}
