import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { requireUser, requireTenant } from "./middleware/auth.js";

import tenantsRouter from "./routes/tenants.js";
import inquiriesRouter from "./routes/inquiries.js";
import templatesRouter from "./routes/templates.js";
import manualsRouter from "./routes/manuals.js";
import deliveryRulesRouter from "./routes/deliveryRules.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, useMockRakuten: config.useMockRakuten });
});

// Tenants: requireUser only — tenant_id may not exist yet on first signup.
app.use("/api/tenants", requireUser, tenantsRouter);

// All other endpoints require both a user and a selected tenant.
app.use("/api/inquiries", requireUser, requireTenant, inquiriesRouter);
app.use("/api/templates", requireUser, requireTenant, templatesRouter);
app.use("/api/manuals", requireUser, requireTenant, manualsRouter);
app.use("/api/delivery-rules", requireUser, requireTenant, deliveryRulesRouter);

// In production, serve the built client.
if (config.nodeEnv === "production") {
  const dist = path.resolve(__dirname, "../dist");
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "server error" });
});

app.listen(config.port, () => {
  console.log(
    `[rms-tool] listening on :${config.port} (mock=${config.useMockRakuten ? "on" : "off"})`,
  );
});
