import { db } from "../db.js";

/**
 * Verifies the Supabase JWT bearer token and loads the requesting user's
 * tenant membership. Attaches `req.user` and `req.tenantId` to the request.
 *
 * Tenant selection: clients send `X-Tenant-Id` (UUID). The middleware
 * confirms the user is a member of that tenant. Without a header, the
 * first tenant the user belongs to is used.
 */
export async function requireUser(req, res, next) {
  const auth = req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing bearer token" });

  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: "invalid token" });
  }
  req.user = data.user;

  const requested = req.header("x-tenant-id");
  const { data: memberships } = await db
    .from("rms_tenant_users")
    .select("tenant_id, role")
    .eq("user_id", req.user.id);

  if (!memberships || memberships.length === 0) {
    req.tenantId = null;
    req.tenantRole = null;
    return next();
  }

  const chosen = requested
    ? memberships.find((m) => m.tenant_id === requested)
    : memberships[0];

  if (requested && !chosen) {
    return res.status(403).json({ error: "not a member of requested tenant" });
  }

  req.tenantId = chosen.tenant_id;
  req.tenantRole = chosen.role;
  req.allTenantIds = memberships.map((m) => m.tenant_id);
  next();
}

export function requireTenant(req, res, next) {
  if (!req.tenantId) {
    return res.status(400).json({ error: "no tenant selected — create one via POST /api/tenants first" });
  }
  next();
}
