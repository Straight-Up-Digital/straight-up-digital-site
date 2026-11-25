import { firestoreClientFromEnv, type FirestoreDocument, type FirestoreValue } from "./firestore.ts";
import type { PaymentOrder, PaymentOrderStore } from "./paystack.ts";
import type { CloudflareWorkerEnv } from "./types.ts";

const TEST_ORDER_COLLECTION = "test_paystack_orders";
const TEST_PROJECT_ID = "straight-up-digital-test";

const stringField = (document: FirestoreDocument, field: string): string | null => {
  const value = document.fields?.[field]?.stringValue;
  return typeof value === "string" ? value : null;
};

const integerField = (document: FirestoreDocument, field: string): number | null => {
  const value = document.fields?.[field]?.integerValue;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const orderToFields = (order: PaymentOrder): Record<string, FirestoreValue> => ({
  reference: { stringValue: order.reference },
  productId: { stringValue: order.productId },
  amountSubunit: { integerValue: String(order.amountSubunit) },
  currency: { stringValue: order.currency },
  status: { stringValue: order.status },
  createdAt: { stringValue: order.createdAt },
  ...(order.paidAt ? { paidAt: { stringValue: order.paidAt } } : {}),
});

function documentToOrder(document: FirestoreDocument): PaymentOrder | null {
  const reference = stringField(document, "reference");
  const productId = stringField(document, "productId");
  const amountSubunit = integerField(document, "amountSubunit");
  const currency = stringField(document, "currency");
  const status = stringField(document, "status");
  const createdAt = stringField(document, "createdAt");
  const paidAt = stringField(document, "paidAt");
  if (!reference || !/^sud-test-[A-Za-z0-9.=\-]{1,90}$/.test(reference)
    || !productId || !/^[a-z0-9-]{1,80}$/.test(productId)
    || amountSubunit === null || amountSubunit < 100
    || currency !== "ZAR"
    || (status !== "pending" && status !== "paid")
    || !createdAt || !Number.isFinite(Date.parse(createdAt))
    || (paidAt !== null && !Number.isFinite(Date.parse(paidAt)))) return null;
  return {
    reference,
    productId,
    amountSubunit,
    currency,
    status,
    createdAt,
    ...(paidAt ? { paidAt } : {}),
  };
}

const sameOrder = (left: PaymentOrder | null, right: PaymentOrder): boolean => Boolean(left
  && left.reference === right.reference
  && left.productId === right.productId
  && left.amountSubunit === right.amountSubunit
  && left.currency === right.currency
  && left.status === right.status
  && left.createdAt === right.createdAt);

export interface PaystackFirestoreClient {
  documentName(collection: string, id: string): string;
  getDocument(collection: string, id: string): Promise<FirestoreDocument | null>;
  patchDocument(collection: string, id: string, fields: Record<string, FirestoreValue>, exists?: boolean): Promise<FirestoreDocument>;
  commit(writes: unknown[]): Promise<void>;
}

export class FirestorePaystackOrderStore implements PaymentOrderStore {
  private readonly env: Pick<CloudflareWorkerEnv, "APP_ENV" | "FIRESTORE_PROJECT_ID" | "GOOGLE_FIRESTORE_SERVICE_ACCOUNT_JSON">;
  private readonly clientFactory?: () => PaystackFirestoreClient;
  private firestore: PaystackFirestoreClient | null = null;

  constructor(
    env: Pick<CloudflareWorkerEnv, "APP_ENV" | "FIRESTORE_PROJECT_ID" | "GOOGLE_FIRESTORE_SERVICE_ACCOUNT_JSON">,
    clientFactory?: () => PaystackFirestoreClient,
  ) {
    this.env = env;
    this.clientFactory = clientFactory;
  }

  private client(): PaystackFirestoreClient {
    if (this.env.APP_ENV !== "test" || this.env.FIRESTORE_PROJECT_ID !== TEST_PROJECT_ID) {
      throw new Error("test_payment_store_disabled");
    }
    if (!this.firestore) this.firestore = this.clientFactory ? this.clientFactory() : firestoreClientFromEnv(this.env);
    return this.firestore;
  }

  async createOrder(order: PaymentOrder): Promise<void> {
    if (order.status !== "pending" || !/^sud-test-[A-Za-z0-9.=\-]{1,90}$/.test(order.reference)
      || !/^[a-z0-9-]{1,80}$/.test(order.productId) || !Number.isSafeInteger(order.amountSubunit)
      || order.amountSubunit < 100 || order.currency !== "ZAR" || !Number.isFinite(Date.parse(order.createdAt))) {
      throw new Error("invalid_test_payment_order");
    }
    const client = this.client();
    try {
      await client.patchDocument(TEST_ORDER_COLLECTION, order.reference, orderToFields(order), false);
    } catch (error) {
      try {
        const existing = await client.getDocument(TEST_ORDER_COLLECTION, order.reference);
        if (sameOrder(existing ? documentToOrder(existing) : null, order)) return;
      } catch {
        // Preserve the original write failure if a safe idempotency check is unavailable.
      }
      throw error;
    }
  }

  async getOrder(reference: string): Promise<PaymentOrder | null> {
    if (!/^sud-test-[A-Za-z0-9.=\-]{1,90}$/.test(reference)) return null;
    const document = await this.client().getDocument(TEST_ORDER_COLLECTION, reference);
    return document ? documentToOrder(document) : null;
  }

  async markPaid(reference: string, paidAt: string): Promise<"paid" | "already_paid" | "missing"> {
    if (!/^sud-test-[A-Za-z0-9.=\-]{1,90}$/.test(reference)) return "missing";
    if (!Number.isFinite(Date.parse(paidAt))) throw new Error("invalid_test_payment_timestamp");
    const client = this.client();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const document = await client.getDocument(TEST_ORDER_COLLECTION, reference);
      if (!document) return "missing";
      const existing = documentToOrder(document);
      if (!existing) return "missing";
      if (existing.status === "paid") return "already_paid";
      const updateTime = (document as FirestoreDocument & { updateTime?: string }).updateTime;
      if (!updateTime) throw new Error("test_payment_update_time_missing");
      const paidOrder: PaymentOrder = { ...existing, status: "paid", paidAt };
      const fields = orderToFields(paidOrder);
      try {
        await client.commit([{
          update: { name: client.documentName(TEST_ORDER_COLLECTION, reference), fields },
          updateMask: { fieldPaths: Object.keys(fields) },
          currentDocument: { updateTime },
        }]);
        return "paid";
      } catch (error) {
        try {
          const latestDocument = await client.getDocument(TEST_ORDER_COLLECTION, reference);
          const latest = latestDocument ? documentToOrder(latestDocument) : null;
          if (latest?.status === "paid") return "already_paid";
        } catch {
          // Retry the compare-and-set; the next read remains authoritative.
        }
        if (attempt === 2) throw error;
      }
    }
    throw new Error("test_payment_update_conflict");
  }
}
