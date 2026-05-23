import { supabase } from "./supabase.js";

const API_BASE = ""; // proxied by Vite in dev; same-origin in prod

async function authHeaders(tenantId) {
  const { data } = await supabase.auth.getSession();
  const headers = { "Content-Type": "application/json" };
  if (data.session?.access_token) {
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  if (tenantId) headers["X-Tenant-Id"] = tenantId;
  return headers;
}

async function request(method, path, { tenantId, body } = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: await authHeaders(tenantId),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.error || `${res.status} ${res.statusText}`);
  }
  return data;
}

export const api = {
  health: () => request("GET", "/health"),

  listTenants: () => request("GET", "/tenants"),
  createTenant: (body) => request("POST", "/tenants", { body }),
  updateCurrentTenant: (tenantId, body) =>
    request("PATCH", "/tenants/current", { tenantId, body }),

  listInquiries: (tenantId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request("GET", `/inquiries${qs ? `?${qs}` : ""}`, { tenantId });
  },
  getInquiry: (tenantId, id) => request("GET", `/inquiries/${id}`, { tenantId }),
  syncInquiries: (tenantId) => request("POST", "/inquiries/sync", { tenantId }),
  generateDraft: (tenantId, inquiryId) =>
    request("POST", `/inquiries/${inquiryId}/generate-draft`, { tenantId }),
  updateDraft: (tenantId, draftId, body) =>
    request("PATCH", `/inquiries/drafts/${draftId}`, { tenantId, body }),

  listTemplates: (tenantId) => request("GET", "/templates", { tenantId }),
  createTemplate: (tenantId, body) => request("POST", "/templates", { tenantId, body }),
  updateTemplate: (tenantId, id, body) =>
    request("PATCH", `/templates/${id}`, { tenantId, body }),
  deleteTemplate: (tenantId, id) => request("DELETE", `/templates/${id}`, { tenantId }),

  listManuals: (tenantId) => request("GET", "/manuals", { tenantId }),
  createManual: (tenantId, body) => request("POST", "/manuals", { tenantId, body }),
  updateManual: (tenantId, id, body) => request("PATCH", `/manuals/${id}`, { tenantId, body }),
  deleteManual: (tenantId, id) => request("DELETE", `/manuals/${id}`, { tenantId }),

  listDeliveryRules: (tenantId) => request("GET", "/delivery-rules", { tenantId }),
  createDeliveryRule: (tenantId, body) =>
    request("POST", "/delivery-rules", { tenantId, body }),
  updateDeliveryRule: (tenantId, id, body) =>
    request("PATCH", `/delivery-rules/${id}`, { tenantId, body }),
  deleteDeliveryRule: (tenantId, id) =>
    request("DELETE", `/delivery-rules/${id}`, { tenantId }),
};
