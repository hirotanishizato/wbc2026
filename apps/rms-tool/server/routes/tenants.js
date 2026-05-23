import { Router } from "express";
import { db } from "../db.js";
import { encrypt } from "../crypto.js";

const router = Router();

// List tenants the requesting user belongs to.
router.get("/", async (req, res) => {
  if (!req.allTenantIds?.length) return res.json({ tenants: [] });
  const { data, error } = await db
    .from("rms_tenants")
    .select("id, name, owner_email, rakuten_shop_url, signature_block, created_at")
    .in("id", req.allTenantIds);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ tenants: data });
});

// Create a new tenant; the requesting user becomes its owner.
router.post("/", async (req, res) => {
  const { name, rakutenShopUrl, signatureBlock } = req.body || {};
  if (!name) return res.status(400).json({ error: "name is required" });

  const { data: tenant, error } = await db
    .from("rms_tenants")
    .insert({
      name,
      owner_email: req.user.email || "",
      rakuten_shop_url: rakutenShopUrl || null,
      signature_block: signatureBlock || null,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  const { error: memErr } = await db
    .from("rms_tenant_users")
    .insert({ tenant_id: tenant.id, user_id: req.user.id, role: "owner" });
  if (memErr) return res.status(500).json({ error: memErr.message });

  res.status(201).json({ tenant });
});

// Update the *current* tenant's credentials / signature.
// req.tenantId is the active tenant scoped by middleware.
router.patch("/current", async (req, res) => {
  if (!req.tenantId) return res.status(400).json({ error: "no active tenant" });
  const {
    name,
    rakutenShopUrl,
    rakutenServiceSecret,
    rakutenLicenseKey,
    geminiApiKey,
    signatureBlock,
  } = req.body || {};

  const patch = { updated_at: new Date().toISOString() };
  if (name !== undefined) patch.name = name;
  if (rakutenShopUrl !== undefined) patch.rakuten_shop_url = rakutenShopUrl;
  if (signatureBlock !== undefined) patch.signature_block = signatureBlock;
  if (rakutenServiceSecret) patch.rakuten_service_secret_enc = encrypt(rakutenServiceSecret);
  if (rakutenLicenseKey) patch.rakuten_license_key_enc = encrypt(rakutenLicenseKey);
  if (geminiApiKey) patch.gemini_api_key_enc = encrypt(geminiApiKey);

  const { data, error } = await db
    .from("rms_tenants")
    .update(patch)
    .eq("id", req.tenantId)
    .select("id, name, owner_email, rakuten_shop_url, signature_block, created_at, updated_at")
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ tenant: data });
});

export default router;
