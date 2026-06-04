-- =============================================================================
-- Black Timber Contracting — Supabase schema (paste entire file into SQL Editor)
-- =============================================================================
-- Run once on a fresh project: Supabase Dashboard → SQL → New query → Run
--
-- What this gives you:
--   • Website leads (replaces .data/leads.jsonl on Vercel)
--   • Admin quotes / estimates / invoices (replaces .data/quotes.jsonl)
--   • Revision history per document (same append-only audit as JSONL)
--   • Optional AI call + rate-limit logs for production debugging
--
-- Your Next.js app talks to Supabase with the SERVICE ROLE key only (server).
-- Row Level Security blocks browser/anon access; no Supabase Auth required for
-- /admin (you keep ADMIN_PASSWORD + session cookie as today).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enums (match src/lib/admin/schemas.ts + src/lib/openrouter/schemas.ts)
-- -----------------------------------------------------------------------------

create type public.lead_source as enum (
  'quote_wizard',
  'site_intel_report',
  'explain_price',
  'concierge_chat',
  'exit_intent',
  'footer'
);

create type public.document_type as enum (
  'quote',
  'estimate',
  'invoice'
);

create type public.document_status as enum (
  'draft',
  'sent',
  'accepted',
  'declined',
  'paid'
);

create type public.tax_mode as enum (
  'real_property_install',
  'supply_only',
  'mixed_split',
  'exempt'
);

create type public.project_type as enum (
  'deck',
  'pergola',
  'garage',
  'addition',
  'fence',
  'renovation',
  'flooring',
  'roofing',
  'siding',
  'interior_finish',
  'structural_repair',
  'other'
);

create type public.line_source as enum (
  'fernie_hh_stocked',
  'fernie_hh_special_order',
  'other_supplier',
  'labor',
  'subcontractor',
  'other'
);

create type public.line_uom as enum (
  'EA', 'LF', 'SQFT', 'BX', 'BG', 'HR', 'DAY', 'LOT'
);

-- -----------------------------------------------------------------------------
-- Utility: auto-update `updated_at`
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- LEADS — public site form submissions
-- -----------------------------------------------------------------------------
create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  source        public.lead_source not null,
  name          text not null check (char_length(name) between 2 and 120),
  email         text not null check (char_length(email) <= 200),
  phone         text check (phone is null or char_length(phone) between 7 and 40),
  address       text check (address is null or char_length(address) <= 300),
  -- Arbitrary JSON: quote wizard output, site intel, chat transcript, etc.
  payload       jsonb not null default '{}'::jsonb,
  -- Delivery fan-out result (mirrors deliverLead() in sink.ts)
  delivered_file   boolean not null default true,
  delivered_email  boolean not null default false,
  delivered_slack  boolean not null default false,
  delivery_errors  text[] not null default '{}',
  created_at    timestamptz not null default now()
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_source_idx on public.leads (source);
create index if not exists leads_email_idx on public.leads (lower(email));

comment on table public.leads is 'Marketing-site lead captures; replaces LEAD_LOG_FILE JSONL.';

-- -----------------------------------------------------------------------------
-- DOCUMENTS — current quote / estimate / invoice (one row per document id)
-- -----------------------------------------------------------------------------
-- IDs look like Q-20260604-AB3C, E-..., I-... (generated in app).
-- Nested customer + project + totals stay JSONB so the TS types map 1:1.
-- Line items are normalized in document_lines for reporting & constraints.
-- -----------------------------------------------------------------------------

create table if not exists public.documents (
  id                    text primary key
    check (id ~ '^[QEI]-\d{8}-[A-Z0-9]{4}$'),
  document_type         public.document_type not null default 'quote',
  status                public.document_status not null default 'draft',
  -- Customer block (AdminQuoteCustomer)
  customer_name         text not null check (char_length(customer_name) between 2 and 120),
  customer_email        text check (customer_email is null or char_length(customer_email) <= 200),
  customer_phone        text check (customer_phone is null or char_length(customer_phone) <= 40),
  customer_billing_address text check (customer_billing_address is null or char_length(customer_billing_address) <= 300),
  customer_job_site_address text check (customer_job_site_address is null or char_length(customer_job_site_address) <= 300),
  -- Project block (scalar fields + scope text)
  project_type          public.project_type not null,
  project_scope_summary text not null check (char_length(project_scope_summary) between 1 and 2000),
  project_length_ft     numeric(8,2) check (project_length_ft is null or project_length_ft between 0 and 500),
  project_width_ft      numeric(8,2) check (project_width_ft is null or project_width_ft between 0 and 500),
  project_material      text check (project_material is null or char_length(project_material) <= 120),
  project_notes         text check (project_notes is null or char_length(project_notes) <= 2000),
  -- Commercial
  tax_mode              public.tax_mode not null,
  freight_cad           numeric(12,2) not null default 0 check (freight_cad >= 0 and freight_cad <= 100000),
  valid_until           date not null,
  internal_notes        text check (internal_notes is null or char_length(internal_notes) <= 4000),
  payment_terms         text check (payment_terms is null or char_length(payment_terms) <= 120),
  payment_instructions  text check (payment_instructions is null or char_length(payment_instructions) <= 800),
  -- Server-computed totals (AdminQuoteTotals) — never trust client on save
  subtotal_cad          numeric(12,2) not null default 0,
  gst_cad               numeric(12,2) not null default 0,
  pst_cad               numeric(12,2) not null default 0,
  grand_total_cad       numeric(12,2) not null default 0,
  max_lead_time_days    integer not null default 0 check (max_lead_time_days >= 0),
  -- Audit
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            text not null default 'admin'
);

create index if not exists documents_updated_at_idx on public.documents (updated_at desc);
create index if not exists documents_type_status_idx on public.documents (document_type, status);
create index if not exists documents_customer_name_idx on public.documents (customer_name);
create index if not exists documents_valid_until_idx on public.documents (valid_until);

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

comment on table public.documents is 'Latest version of each Q-/E-/I- document; replaces quotes JSONL current state.';

-- -----------------------------------------------------------------------------
-- DOCUMENT LINES — line items (normalized)
-- -----------------------------------------------------------------------------
create table if not exists public.document_lines (
  id              text not null,
  document_id     text not null references public.documents (id) on delete cascade,
  sort_order      integer not null default 0 check (sort_order >= 0),
  description     text not null check (char_length(description) between 1 and 280),
  quantity        numeric(14,4) not null default 1 check (quantity >= 0 and quantity <= 100000),
  uom             public.line_uom not null default 'EA',
  unit_price_cad  numeric(12,2) not null default 0 check (unit_price_cad >= 0 and unit_price_cad <= 1000000),
  source          public.line_source not null default 'other',
  lead_time_days  integer check (lead_time_days is null or (lead_time_days >= 0 and lead_time_days <= 365)),
  notes           text check (notes is null or char_length(notes) <= 280),
  primary key (document_id, id)
);

create index if not exists document_lines_document_idx on public.document_lines (document_id, sort_order);

comment on table public.document_lines is 'Line items for admin documents; replaced on each save (transaction in app).';

-- -----------------------------------------------------------------------------
-- DOCUMENT REVISIONS — append-only history (replaces JSONL re-append pattern)
-- -----------------------------------------------------------------------------
create table if not exists public.document_revisions (
  id            uuid primary key default gen_random_uuid(),
  document_id   text not null references public.documents (id) on delete cascade,
  -- Full snapshot as saved by the app (AdminQuoteSaved shape)
  snapshot      jsonb not null,
  created_at    timestamptz not null default now()
);

create index if not exists document_revisions_document_idx
  on public.document_revisions (document_id, created_at desc);

comment on table public.document_revisions is 'Every save appends a row; audit trail like quotes.jsonl.';

-- -----------------------------------------------------------------------------
-- AI CALL LOGS — optional production observability (mirrors logAiCall)
-- -----------------------------------------------------------------------------
create table if not exists public.ai_call_logs (
  id                  uuid primary key default gen_random_uuid(),
  task                text not null,
  model               text,
  schema_name         text,
  prompt_tokens       integer,
  completion_tokens   integer,
  cost_usd            numeric(10,6),
  latency_ms          integer,
  ok                  boolean not null default true,
  error_message       text,
  created_at          timestamptz not null default now()
);

create index if not exists ai_call_logs_created_at_idx on public.ai_call_logs (created_at desc);
create index if not exists ai_call_logs_task_idx on public.ai_call_logs (task);

comment on table public.ai_call_logs is 'Server-side AI telemetry; optional but useful on Vercel.';

-- -----------------------------------------------------------------------------
-- RATE LIMIT EVENTS — distributed rate limiting across serverless instances
-- -----------------------------------------------------------------------------
create table if not exists public.rate_limit_events (
  id          bigserial primary key,
  limit_name  text not null,
  client_ip   text not null,
  created_at  timestamptz not null default now()
);

create index if not exists rate_limit_events_lookup_idx
  on public.rate_limit_events (limit_name, client_ip, created_at desc);

comment on table public.rate_limit_events is 'Hit log for /api/* rate limits; prune old rows with cron.';

-- -----------------------------------------------------------------------------
-- Helper view: recent documents sidebar (matches listQuotes UI)
-- -----------------------------------------------------------------------------
create or replace view public.documents_recent as
select
  d.id,
  d.document_type,
  d.status,
  d.customer_name,
  d.grand_total_cad,
  d.updated_at,
  d.valid_until
from public.documents d
order by d.updated_at desc;

comment on view public.documents_recent is 'Convenience view for admin sidebar; not security-sensitive.';

-- -----------------------------------------------------------------------------
-- RPC: upsert document + lines in one transaction (call from Next.js)
-- -----------------------------------------------------------------------------
create or replace function public.upsert_document(
  p_document jsonb,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_line jsonb;
  v_sort int := 0;
begin
  v_id := p_document->>'id';

  insert into public.documents (
    id, document_type, status,
    customer_name, customer_email, customer_phone,
    customer_billing_address, customer_job_site_address,
    project_type, project_scope_summary,
    project_length_ft, project_width_ft, project_material, project_notes,
    tax_mode, freight_cad, valid_until,
    internal_notes, payment_terms, payment_instructions,
    subtotal_cad, gst_cad, pst_cad, grand_total_cad, max_lead_time_days,
    created_at, updated_at, created_by
  )
  values (
    v_id,
    (p_document->>'documentType')::public.document_type,
    (p_document->>'status')::public.document_status,
    p_document->'customer'->>'name',
    nullif(p_document->'customer'->>'email', ''),
    nullif(p_document->'customer'->>'phone', ''),
    nullif(p_document->'customer'->>'billingAddress', ''),
    nullif(p_document->'customer'->>'jobSiteAddress', ''),
    (p_document->'project'->>'type')::public.project_type,
    p_document->'project'->>'scopeSummary',
    nullif(trim(p_document->'project'->>'lengthFt'), '')::numeric,
    nullif(trim(p_document->'project'->>'widthFt'), '')::numeric,
    nullif(p_document->'project'->>'material', ''),
    nullif(p_document->'project'->>'notes', ''),
    (p_document->>'taxMode')::public.tax_mode,
    coalesce((p_document->>'freightCAD')::numeric, 0),
    (p_document->>'validUntil')::date,
    nullif(p_document->>'internalNotes', ''),
    nullif(p_document->>'paymentTerms', ''),
    nullif(p_document->>'paymentInstructions', ''),
    (p_document->'totals'->>'subtotalCAD')::numeric,
    (p_document->'totals'->>'gstCAD')::numeric,
    (p_document->'totals'->>'pstCAD')::numeric,
    (p_document->'totals'->>'grandTotalCAD')::numeric,
    coalesce((p_document->'totals'->>'maxLeadTimeDays')::integer, 0),
    coalesce((p_document->>'createdAt')::timestamptz, now()),
    coalesce((p_document->>'updatedAt')::timestamptz, now()),
    coalesce(p_document->>'createdBy', 'admin')
  )
  on conflict (id) do update set
    document_type = excluded.document_type,
    status = excluded.status,
    customer_name = excluded.customer_name,
    customer_email = excluded.customer_email,
    customer_phone = excluded.customer_phone,
    customer_billing_address = excluded.customer_billing_address,
    customer_job_site_address = excluded.customer_job_site_address,
    project_type = excluded.project_type,
    project_scope_summary = excluded.project_scope_summary,
    project_length_ft = excluded.project_length_ft,
    project_width_ft = excluded.project_width_ft,
    project_material = excluded.project_material,
    project_notes = excluded.project_notes,
    tax_mode = excluded.tax_mode,
    freight_cad = excluded.freight_cad,
    valid_until = excluded.valid_until,
    internal_notes = excluded.internal_notes,
    payment_terms = excluded.payment_terms,
    payment_instructions = excluded.payment_instructions,
    subtotal_cad = excluded.subtotal_cad,
    gst_cad = excluded.gst_cad,
    pst_cad = excluded.pst_cad,
    grand_total_cad = excluded.grand_total_cad,
    max_lead_time_days = excluded.max_lead_time_days,
    updated_at = excluded.updated_at,
    created_by = excluded.created_by;

  delete from public.document_lines where document_id = v_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    insert into public.document_lines (
      id, document_id, sort_order,
      description, quantity, uom, unit_price_cad,
      source, lead_time_days, notes
    )
    values (
      v_line->>'id',
      v_id,
      v_sort,
      v_line->>'description',
      coalesce((v_line->>'quantity')::numeric, 1),
      coalesce((v_line->>'uom')::public.line_uom, 'EA'),
      coalesce((v_line->>'unitPriceCAD')::numeric, 0),
      coalesce((v_line->>'source')::public.line_source, 'other'),
      nullif(trim(v_line->>'leadTimeDays'), '')::integer,
      nullif(v_line->>'notes', '')
    );
    v_sort := v_sort + 1;
  end loop;

  insert into public.document_revisions (document_id, snapshot)
  values (v_id, p_document);

  return p_document;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: load one document as AdminQuoteSaved-shaped JSON
-- -----------------------------------------------------------------------------
create or replace function public.get_document(p_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d public.documents%rowtype;
  v_lines jsonb;
begin
  select * into d from public.documents where id = p_id;
  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', l.id,
      'description', l.description,
      'quantity', l.quantity,
      'uom', l.uom,
      'unitPriceCAD', l.unit_price_cad,
      'source', l.source,
      'leadTimeDays', l.lead_time_days,
      'notes', l.notes
    ) order by l.sort_order
  ), '[]'::jsonb)
  into v_lines
  from public.document_lines l
  where l.document_id = p_id;

  return jsonb_build_object(
    'id', d.id,
    'documentType', d.document_type,
    'status', d.status,
    'customer', jsonb_build_object(
      'name', d.customer_name,
      'email', d.customer_email,
      'phone', d.customer_phone,
      'billingAddress', d.customer_billing_address,
      'jobSiteAddress', d.customer_job_site_address
    ),
    'project', jsonb_build_object(
      'type', d.project_type,
      'scopeSummary', d.project_scope_summary,
      'lengthFt', d.project_length_ft,
      'widthFt', d.project_width_ft,
      'material', d.project_material,
      'notes', d.project_notes
    ),
    'lines', v_lines,
    'taxMode', d.tax_mode,
    'freightCAD', d.freight_cad,
    'validUntil', to_char(d.valid_until, 'YYYY-MM-DD'),
    'internalNotes', d.internal_notes,
    'paymentTerms', d.payment_terms,
    'paymentInstructions', d.payment_instructions,
    'totals', jsonb_build_object(
      'subtotalCAD', d.subtotal_cad,
      'freightCAD', d.freight_cad,
      'gstCAD', d.gst_cad,
      'pstCAD', d.pst_cad,
      'grandTotalCAD', d.grand_total_cad,
      'maxLeadTimeDays', d.max_lead_time_days
    ),
    'createdAt', to_char(timezone('UTC', d.created_at), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'updatedAt', to_char(timezone('UTC', d.updated_at), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'createdBy', d.created_by
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: list recent documents (sidebar)
-- -----------------------------------------------------------------------------
create or replace function public.list_documents(p_limit integer default 50)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  from (
    select
      id,
      customer_name as "customerName",
      grand_total_cad as "grandTotalCAD",
      to_char(timezone('UTC', updated_at), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "updatedAt",
      status::text as status
    from public.documents
    order by updated_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 200))
  ) t;
$$;

-- -----------------------------------------------------------------------------
-- RPC: insert lead
-- -----------------------------------------------------------------------------
create or replace function public.insert_lead(
  p_source public.lead_source,
  p_name text,
  p_email text,
  p_phone text default null,
  p_address text default null,
  p_payload jsonb default '{}'::jsonb,
  p_delivered_file boolean default true,
  p_delivered_email boolean default false,
  p_delivered_slack boolean default false,
  p_delivery_errors text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.leads (
    source, name, email, phone, address, payload,
    delivered_file, delivered_email, delivered_slack, delivery_errors
  )
  values (
    p_source, p_name, p_email, p_phone, p_address, coalesce(p_payload, '{}'::jsonb),
    p_delivered_file, p_delivered_email, p_delivered_slack, coalesce(p_delivery_errors, '{}')
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: rate limit check (distributed; optional replacement for in-memory map)
-- -----------------------------------------------------------------------------
create or replace function public.check_rate_limit(
  p_limit_name text,
  p_client_ip text,
  p_max_hits integer,
  p_window_sec integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_window_start timestamptz;
begin
  v_window_start := now() - make_interval(secs => p_window_sec);

  select count(*)::integer into v_count
  from public.rate_limit_events
  where limit_name = p_limit_name
    and client_ip = p_client_ip
    and created_at >= v_window_start;

  if v_count >= p_max_hits then
    return false;
  end if;

  insert into public.rate_limit_events (limit_name, client_ip) values (p_limit_name, p_client_ip);
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security — deny public; server uses service_role (bypasses RLS)
-- -----------------------------------------------------------------------------
alter table public.leads enable row level security;
alter table public.documents enable row level security;
alter table public.document_lines enable row level security;
alter table public.document_revisions enable row level security;
alter table public.ai_call_logs enable row level security;
alter table public.rate_limit_events enable row level security;

-- No policies for anon/authenticated → only service_role can read/write.
-- (service_role bypasses RLS by default in Supabase)

-- -----------------------------------------------------------------------------
-- Grants: allow service_role full access (Postgres role used by server SDK)
-- -----------------------------------------------------------------------------
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
grant execute on function public.upsert_document(jsonb, jsonb) to service_role;
grant execute on function public.get_document(text) to service_role;
grant execute on function public.list_documents(integer) to service_role;

-- Revoke anon/authenticated table access (belt + suspenders with RLS)
revoke all on public.leads from anon, authenticated;
revoke all on public.documents from anon, authenticated;
revoke all on public.document_lines from anon, authenticated;
revoke all on public.document_revisions from anon, authenticated;
revoke all on public.ai_call_logs from anon, authenticated;
revoke all on public.rate_limit_events from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Optional: prune old rate-limit rows (run via Supabase cron weekly)
-- -----------------------------------------------------------------------------
-- delete from public.rate_limit_events where created_at < now() - interval '7 days';

-- =============================================================================
-- DONE. Next steps (in your app / Vercel):
--   SUPABASE_URL=https://xxxx.supabase.co
--   SUPABASE_SECRET_KEY=sb_secret_...   (or legacy SUPABASE_SERVICE_ROLE_KEY)
--   Do NOT expose secret keys to the browser.
--
-- Also run: supabase/files-schema.sql (admin file vault + btc-admin-files bucket)
-- =============================================================================
