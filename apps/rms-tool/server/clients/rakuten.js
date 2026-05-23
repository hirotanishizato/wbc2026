/**
 * Unified Rakuten RMS facade.
 *
 * Switches between mock and real clients based on config.useMockRakuten.
 * Every call accepts the tenant row (decrypted credentials attached) so
 * different tenants can hit RMS with their own service secret / license key.
 */
import { config } from "../config.js";
import * as mock from "./rakuten-mock.js";
import * as real from "./rakuten-real.js";

function getTenantCreds(tenant) {
  return {
    serviceSecret: tenant._creds?.rakutenServiceSecret,
    licenseKey: tenant._creds?.rakutenLicenseKey,
  };
}

export async function listInquiries(tenant) {
  if (config.useMockRakuten) return mock.listInquiries();
  return real.listInquiries(getTenantCreds(tenant));
}

export async function getOrder(tenant, orderNumber) {
  if (!orderNumber) return null;
  if (config.useMockRakuten) return mock.getOrder(orderNumber);
  return real.getOrder(getTenantCreds(tenant), orderNumber);
}

export async function searchOrdersByMember(tenant, memberId) {
  if (!memberId) return [];
  if (config.useMockRakuten) return mock.searchOrdersByMember(memberId);
  return real.searchOrdersByMember(getTenantCreds(tenant), memberId);
}

export async function getItem(tenant, itemCode) {
  if (!itemCode) return null;
  if (config.useMockRakuten) return mock.getItem(itemCode);
  return real.getItem(getTenantCreds(tenant), itemCode);
}
