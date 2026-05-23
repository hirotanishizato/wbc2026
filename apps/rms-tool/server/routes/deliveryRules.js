import { Router } from "express";
import { db } from "../db.js";

const router = Router();

router.get("/", async (req, res) => {
  const { data, error } = await db
    .from("rms_delivery_rules")
    .select("*")
    .eq("tenant_id", req.tenantId)
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ rules: data });
});

router.post("/", async (req, res) => {
  const { name, description, rule, priority, enabled } = req.body || {};
  if (!name || !rule) return res.status(400).json({ error: "name and rule are required" });
  const { data, error } = await db
    .from("rms_delivery_rules")
    .insert({
      tenant_id: req.tenantId,
      name,
      description: description || null,
      rule,
      priority: priority || 0,
      enabled: enabled !== false,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ rule: data });
});

router.patch("/:id", async (req, res) => {
  const { name, description, rule, priority, enabled } = req.body || {};
  const patch = { updated_at: new Date().toISOString() };
  if (name !== undefined) patch.name = name;
  if (description !== undefined) patch.description = description;
  if (rule !== undefined) patch.rule = rule;
  if (priority !== undefined) patch.priority = priority;
  if (enabled !== undefined) patch.enabled = enabled;
  const { data, error } = await db
    .from("rms_delivery_rules")
    .update(patch)
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ rule: data });
});

router.delete("/:id", async (req, res) => {
  const { error } = await db
    .from("rms_delivery_rules")
    .delete()
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

export default router;
