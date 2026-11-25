import type { PaymentOrder, PaymentOrderStore } from "./paystack.ts";
import type { CloudflareWorkerEnv } from "./types.ts";

interface D1Result { success: boolean; meta?: { changes?: number } }
interface D1Statement {
  bind(...values: Array<string | number | null>): D1Statement;
  first<T extends Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1Result>;
}
interface D1DatabaseBinding { prepare(query: string): D1Statement }
interface OrderRow extends Record<string, unknown> {
  reference: unknown;
  product_id: unknown;
  amount_subunit: unknown;
  currency: unknown;
  status: unknown;
  created_at: unknown;
  paid_at: unknown;
}

const ORDER_TABLE = "test_paystack_orders";
const REFERENCE_PATTERN = /^sud-test-[A-Za-z0-9.=\-]{1,90}$/;
const PRODUCT_PATTERN = /^[a-z0-9-]{1,80}$/;

function rowToOrder(row: OrderRow | null): PaymentOrder | null {
  if (!row) return null;
  const reference = row.reference;
  const productId = row.product_id;
  const amountSubunit = typeof row.amount_subunit === "number" ? row.amount_subunit : Number(row.amount_subunit);
  const currency = row.currency;
  const status = row.status;
  const createdAt = row.created_at;
  const paidAt = row.paid_at;
  if (typeof reference !== "string" || !REFERENCE_PATTERN.test(reference)
    || typeof productId !== "string" || !PRODUCT_PATTERN.test(productId)
    || !Number.isSafeInteger(amountSubunit) || amountSubunit < 100
    || currency !== "ZAR" || (status !== "pending" && status !== "paid")
    || typeof createdAt !== "string" || !Number.isFinite(Date.parse(createdAt))
    || (paidAt !== null && paidAt !== undefined && (typeof paidAt !== "string" || !Number.isFinite(Date.parse(paidAt))))) return null;
  return {
    reference,
    productId,
    amountSubunit,
    currency,
    status,
    createdAt,
    ...(typeof paidAt === "string" && paidAt ? { paidAt } : {}),
  };
}

const sameOrder = (left: PaymentOrder | null, right: PaymentOrder): boolean => Boolean(left
  && left.reference === right.reference
  && left.productId === right.productId
  && left.amountSubunit === right.amountSubunit
  && left.currency === right.currency
  && left.status === right.status
  && left.createdAt === right.createdAt);

export class D1PaystackOrderStore implements PaymentOrderStore {
  private readonly env: Pick<CloudflareWorkerEnv, "APP_ENV" | "PAYMENTS_DB">;

  constructor(env: Pick<CloudflareWorkerEnv, "APP_ENV" | "PAYMENTS_DB">) {
    this.env = env;
  }

  private database(): D1DatabaseBinding {
    if (this.env.APP_ENV !== "test" || !this.env.PAYMENTS_DB) throw new Error("test_payment_store_disabled");
    return this.env.PAYMENTS_DB;
  }

  async createOrder(order: PaymentOrder): Promise<void> {
    if (order.status !== "pending" || !REFERENCE_PATTERN.test(order.reference)
      || !PRODUCT_PATTERN.test(order.productId) || !Number.isSafeInteger(order.amountSubunit)
      || order.amountSubunit < 100 || order.currency !== "ZAR" || !Number.isFinite(Date.parse(order.createdAt))) {
      throw new Error("invalid_test_payment_order");
    }
    const database = this.database();
    try {
      await database.prepare(`INSERT INTO ${ORDER_TABLE} (reference, product_id, amount_subunit, currency, status, created_at, paid_at) VALUES (?, ?, ?, ?, ?, ?, NULL)`)
        .bind(order.reference, order.productId, order.amountSubunit, order.currency, order.status, order.createdAt)
        .run();
    } catch (error) {
      try {
        if (sameOrder(await this.getOrder(order.reference), order)) return;
      } catch {
        // Preserve the original write failure if a safe idempotency check is unavailable.
      }
      throw error;
    }
  }

  async getOrder(reference: string): Promise<PaymentOrder | null> {
    if (!REFERENCE_PATTERN.test(reference)) return null;
    const row = await this.database().prepare(`SELECT reference, product_id, amount_subunit, currency, status, created_at, paid_at FROM ${ORDER_TABLE} WHERE reference = ?`)
      .bind(reference)
      .first<OrderRow>();
    return rowToOrder(row);
  }

  async markPaid(reference: string, paidAt: string): Promise<"paid" | "already_paid" | "missing"> {
    if (!REFERENCE_PATTERN.test(reference)) return "missing";
    if (!Number.isFinite(Date.parse(paidAt))) throw new Error("invalid_test_payment_timestamp");
    const result = await this.database().prepare(`UPDATE ${ORDER_TABLE} SET status = 'paid', paid_at = ? WHERE reference = ? AND status = 'pending'`)
      .bind(paidAt, reference)
      .run();
    if ((result.meta?.changes ?? 0) > 0) return "paid";
    const existing = await this.getOrder(reference);
    return existing?.status === "paid" ? "already_paid" : "missing";
  }
}
