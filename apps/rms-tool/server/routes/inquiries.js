import { Router } from "express";
import { db } from "../db.js";
import { syncTenantInquiries } from "../services/syncInquiries.js";
import { generateDraftForInquiry } from "../services/draftGenerator.js";

const router = Router();

// List inquiries (newest first), optional ?status= filter.
router.get("/", async (req, res) => {
  const { status, limit = 100 } = req.query;
  let q = db
    .from("rms_inquiries")
    .select("*")
    .eq("tenant_id", req.tenantId)
    .order("received_at", { ascending: false })
    .limit(Math.min(Number(limit) || 100, 500));
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ inquiries: data });
});

// Fetch one inquiry + its latest draft.
router.get("/:id", async (req, res) => {
  const { data: inquiry, error } = await db
    .from("rms_inquiries")
    .select("*")
    .eq("tenant_id", req.tenantId)
    .eq("id", req.params.id)
    .single();
  if (error || !inquiry) return res.status(404).json({ error: "not found" });

  const { data: drafts } = await db
    .from("rms_drafts")
    .select("*")
    .eq("inquiry_id", inquiry.id)
    .order("created_at", { ascending: false });

  res.json({ inquiry, drafts: drafts || [] });
});

// Trigger a sync from R-Messe for the current tenant.
router.post("/sync", async (req, res) => {
  try {
    const result = await syncTenantInquiries(req.tenantId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Generate (or regenerate) the AI draft for one inquiry.
router.post("/:id/generate-draft", async (req, res) => {
  try {
    const result = await generateDraftForInquiry(req.tenantId, req.params.id);
    res.json({
      draft: result.draft,
      meta: {
        usedOrder: result.order?.orderNumber || null,
        usedItem: result.item?.itemCode || null,
        templateCount: result.templates.length,
        manualCount: result.manuals.length,
        deliveryComputed: !!result.computedDelivery,
        deliveryMessage: result.computedDelivery?.message || null,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Edit a draft body before approving.
router.patch("/drafts/:draftId", async (req, res) => {
  const { body, status } = req.body || {};
  const patch = {};
  if (body !== undefined) patch.body = body;
  if (status !== undefined) patch.status = status;
  if (status === "approved") {
    patch.approved_at = new Date().toISOString();
    patch.approved_by = req.user.id;
  }
  const { data, error } = await db
    .from("rms_drafts")
    .update(patch)
    .eq("id", req.params.draftId)
    .eq("tenant_id", req.tenantId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  if (status === "approved") {
    await db
      .from("rms_inquiries")
      .update({ status: "approved" })
      .eq("id", data.inquiry_id)
      .eq("tenant_id", req.tenantId);
  }

  res.json({ draft: data });
});

export default router;
