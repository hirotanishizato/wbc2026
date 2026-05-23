/**
 * Real Rakuten RMS WEB API client (skeleton).
 *
 * Activated when USE_MOCK_RAKUTEN=false. Endpoint paths and the exact
 * request/response shapes shown here are placeholders — fill in once
 * the live RMS WEB API contract is in hand.
 *
 * Authentication: RMS uses an `ESA` Authorization header built from
 * Base64(`serviceSecret:licenseKey`).
 *
 * Reference: https://webservice.rms.rakuten.co.jp/merchant-portal/
 */
import { config } from "../config.js";

function authHeader(tenantCreds) {
  const raw = `${tenantCreds.serviceSecret}:${tenantCreds.licenseKey}`;
  const token = Buffer.from(raw, "utf8").toString("base64");
  return `ESA ${token}`;
}

async function rmsFetch(tenantCreds, pathname, opts = {}) {
  const url = `${config.rakuten.apiBase}${pathname}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(tenantCreds),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Rakuten RMS ${pathname} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function listInquiries(tenantCreds) {
  // TODO: replace with actual R-Messe message-list endpoint once confirmed.
  // Expected response is mapped to the same shape as rakuten-mock.js.
  const json = await rmsFetch(tenantCreds, "/es/2.0/messages/search", {
    method: "POST",
    body: JSON.stringify({ limit: 100 }),
  });
  return (json.messages || []).map((m) => ({
    messageId: m.messageId,
    threadId: m.threadId,
    customerName: m.customer?.name ?? null,
    customerEmail: m.customer?.email ?? null,
    customerMemberId: m.customer?.memberId ?? null,
    relatedItemCode: m.relatedItemCode ?? null,
    relatedOrderNumber: m.relatedOrderNumber ?? null,
    subject: m.subject ?? null,
    body: m.body,
    receivedAt: m.receivedAt,
  }));
}

export async function getOrder(tenantCreds, orderNumber) {
  const json = await rmsFetch(tenantCreds, `/es/2.0/order/getOrder`, {
    method: "POST",
    body: JSON.stringify({ orderNumberList: [orderNumber] }),
  });
  const order = json.orders?.[0];
  if (!order) return null;
  return {
    orderNumber: order.orderNumber,
    orderedAt: order.orderDatetime,
    customerMemberId: order.customer?.memberId ?? null,
    customerName: order.customer?.name ?? null,
    items: (order.items || []).map((it) => ({
      itemCode: it.manageNumber,
      itemName: it.itemName,
      quantity: it.units,
      price: it.price,
      shopComment: it.shopComment ?? null,
      scheduledShipDate: it.scheduledShipDate ?? null,
    })),
    paymentStatus: order.paymentStatus,
    shipStatus: order.shipStatus,
  };
}

export async function searchOrdersByMember(tenantCreds, memberId) {
  const json = await rmsFetch(tenantCreds, `/es/2.0/order/searchOrder`, {
    method: "POST",
    body: JSON.stringify({ memberId, limit: 20 }),
  });
  return json.orderNumberList || [];
}

export async function getItem(tenantCreds, itemCode) {
  const json = await rmsFetch(tenantCreds, `/es/2.0/items/${encodeURIComponent(itemCode)}`, {
    method: "GET",
  });
  return {
    itemCode: json.manageNumber,
    itemName: json.title,
    itemUrl: json.itemUrl,
    price: json.standardPrice,
    description: json.description ?? "",
    sizes: json.variants?.size ?? [],
    colors: json.variants?.color ?? [],
  };
}
