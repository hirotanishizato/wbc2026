/**
 * Pulls fresh messages from R-Messe (real or mock) into the local DB.
 * Idempotent: relies on UNIQUE (tenant_id, rmesse_message_id).
 */
import { db } from "../db.js";
import * as rakuten from "../clients/rakuten.js";
import { loadTenantWithCreds } from "./tenants.js";

export async function syncTenantInquiries(tenantId) {
  const tenant = await loadTenantWithCreds(tenantId);
  if (!tenant) throw new Error("tenant not found");

  const messages = await rakuten.listInquiries(tenant);
  if (!Array.isArray(messages) || messages.length === 0) {
    return { fetched: 0, inserted: 0 };
  }

  const rows = messages.map((m) => ({
    tenant_id: tenantId,
    rmesse_message_id: m.messageId,
    thread_id: m.threadId,
    customer_name: m.customerName,
    customer_email: m.customerEmail,
    customer_member_id: m.customerMemberId,
    related_item_code: m.relatedItemCode,
    related_order_number: m.relatedOrderNumber,
    subject: m.subject,
    body: m.body,
    received_at: m.receivedAt,
    raw: m,
  }));

  const { data, error } = await db
    .from("rms_inquiries")
    .upsert(rows, {
      onConflict: "tenant_id,rmesse_message_id",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) throw error;

  return { fetched: messages.length, inserted: data?.length ?? 0 };
}
