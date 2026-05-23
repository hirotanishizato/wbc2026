import { Router } from "express";
import { db } from "../db.js";

const router = Router();

router.get("/", async (req, res) => {
  const { data, error } = await db
    .from("rms_templates")
    .select("*")
    .eq("tenant_id", req.tenantId)
    .order("updated_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ templates: data });
});

router.post("/", async (req, res) => {
  const { title, category, triggerKeywords, body, enabled } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: "title and body are required" });
  const { data, error } = await db
    .from("rms_templates")
    .insert({
      tenant_id: req.tenantId,
      title,
      category: category || null,
      trigger_keywords: triggerKeywords || [],
      body,
      enabled: enabled !== false,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ template: data });
});

router.patch("/:id", async (req, res) => {
  const { title, category, triggerKeywords, body, enabled } = req.body || {};
  const patch = { updated_at: new Date().toISOString() };
  if (title !== undefined) patch.title = title;
  if (category !== undefined) patch.category = category;
  if (triggerKeywords !== undefined) patch.trigger_keywords = triggerKeywords;
  if (body !== undefined) patch.body = body;
  if (enabled !== undefined) patch.enabled = enabled;
  const { data, error } = await db
    .from("rms_templates")
    .update(patch)
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ template: data });
});

router.delete("/:id", async (req, res) => {
  const { error } = await db
    .from("rms_templates")
    .delete()
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

export default router;
