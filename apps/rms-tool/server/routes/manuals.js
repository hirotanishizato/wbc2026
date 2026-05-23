import { Router } from "express";
import { db } from "../db.js";

const router = Router();

router.get("/", async (req, res) => {
  const { data, error } = await db
    .from("rms_manuals")
    .select("*")
    .eq("tenant_id", req.tenantId)
    .order("updated_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ manuals: data });
});

router.post("/", async (req, res) => {
  const { title, category, itemCode, triggerKeywords, content, enabled } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: "title and content are required" });
  const { data, error } = await db
    .from("rms_manuals")
    .insert({
      tenant_id: req.tenantId,
      title,
      category: category || null,
      item_code: itemCode || null,
      trigger_keywords: triggerKeywords || [],
      content,
      enabled: enabled !== false,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ manual: data });
});

router.patch("/:id", async (req, res) => {
  const { title, category, itemCode, triggerKeywords, content, enabled } = req.body || {};
  const patch = { updated_at: new Date().toISOString() };
  if (title !== undefined) patch.title = title;
  if (category !== undefined) patch.category = category;
  if (itemCode !== undefined) patch.item_code = itemCode;
  if (triggerKeywords !== undefined) patch.trigger_keywords = triggerKeywords;
  if (content !== undefined) patch.content = content;
  if (enabled !== undefined) patch.enabled = enabled;
  const { data, error } = await db
    .from("rms_manuals")
    .update(patch)
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ manual: data });
});

router.delete("/:id", async (req, res) => {
  const { error } = await db
    .from("rms_manuals")
    .delete()
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

export default router;
