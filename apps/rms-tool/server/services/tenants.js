import { db } from "../db.js";
import { decrypt } from "../crypto.js";

/**
 * Loads a tenant row and attaches decrypted credentials under `._creds`.
 * Callers that pass the tenant object to API clients (Rakuten / Gemini)
 * never see encrypted values; the keys live in memory only for the
 * duration of the request.
 */
export async function loadTenantWithCreds(tenantId) {
  const { data, error } = await db
    .from("rms_tenants")
    .select("*")
    .eq("id", tenantId)
    .single();
  if (error || !data) return null;

  data._creds = {
    rakutenServiceSecret: decrypt(data.rakuten_service_secret_enc),
    rakutenLicenseKey: decrypt(data.rakuten_license_key_enc),
    geminiApiKey: decrypt(data.gemini_api_key_enc),
  };
  return data;
}
