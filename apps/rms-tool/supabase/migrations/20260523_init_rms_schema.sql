-- =========================================================================
-- RMS Tool initial schema
-- Multi-tenant: every row except `rms_tenants` is scoped via tenant_id.
-- Backend enforces tenant isolation in queries; service-role key is used
-- server-side only. Adding RLS policies later is recommended.
-- =========================================================================

-- ---- Tenants (one tenant per Rakuten shop using the SaaS) ----------------
create table if not exists rms_tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_email text not null,
  -- All credential fields are stored encrypted (AES-256-GCM) by the backend.
  rakuten_service_secret_enc text,
  rakuten_license_key_enc text,
  rakuten_shop_url text,
  gemini_api_key_enc text,
  signature_block text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- Tenant membership ---------------------------------------------------
create table if not exists rms_tenant_users (
  tenant_id uuid not null references rms_tenants(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index if not exists rms_tenant_users_user_idx on rms_tenant_users(user_id);

-- ---- Inquiries (one row per R-Messe message) -----------------------------
create table if not exists rms_inquiries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references rms_tenants(id) on delete cascade,
  rmesse_message_id text not null,
  thread_id text,
  customer_name text,
  customer_email text,
  customer_member_id text,
  related_item_code text,
  related_order_number text,
  subject text,
  body text not null,
  status text not null default 'new' check (status in ('new','drafted','approved','sent','closed')),
  received_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, rmesse_message_id)
);
create index if not exists rms_inquiries_tenant_status_idx on rms_inquiries(tenant_id, status, received_at desc);

-- ---- AI-generated reply drafts ------------------------------------------
create table if not exists rms_drafts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references rms_tenants(id) on delete cascade,
  inquiry_id uuid not null references rms_inquiries(id) on delete cascade,
  body text not null,
  model text,
  used_template_ids uuid[] not null default '{}',
  used_manual_ids uuid[] not null default '{}',
  used_delivery_rule_ids uuid[] not null default '{}',
  used_order_number text,
  used_item_code text,
  generation_meta jsonb,
  status text not null default 'draft' check (status in ('draft','approved','sent','discarded')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid
);
create index if not exists rms_drafts_inquiry_idx on rms_drafts(inquiry_id, created_at desc);

-- ---- Reply templates -----------------------------------------------------
create table if not exists rms_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references rms_tenants(id) on delete cascade,
  title text not null,
  category text,
  trigger_keywords text[] not null default '{}',
  body text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rms_templates_tenant_idx on rms_templates(tenant_id, enabled);

-- ---- Manuals (knowledge base entries) -----------------------------------
create table if not exists rms_manuals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references rms_tenants(id) on delete cascade,
  title text not null,
  category text,
  item_code text,
  trigger_keywords text[] not null default '{}',
  content text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rms_manuals_tenant_item_idx on rms_manuals(tenant_id, item_code);

-- ---- Delivery rules ------------------------------------------------------
-- rule jsonb shape (example):
-- {
--   "order_before": "14:00",          -- order received before this time...
--   "ship_within_business_days": 1,   -- ...will ship in N business days
--   "exclude_weekends": true,
--   "exclude_holidays": true,
--   "item_codes": ["abc-123"],        -- optional: restrict to these items
--   "categories": ["food"]            -- optional
-- }
create table if not exists rms_delivery_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references rms_tenants(id) on delete cascade,
  name text not null,
  description text,
  rule jsonb not null,
  priority int not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rms_delivery_rules_tenant_idx on rms_delivery_rules(tenant_id, enabled, priority desc);

-- ---- Audit log (optional, light) ----------------------------------------
create table if not exists rms_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references rms_tenants(id) on delete cascade,
  user_id uuid,
  action text not null,
  target_type text,
  target_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists rms_audit_log_tenant_idx on rms_audit_log(tenant_id, created_at desc);
