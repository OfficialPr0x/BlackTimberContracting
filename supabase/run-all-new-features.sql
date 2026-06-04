-- =============================================================================
-- Black Timber Contracting — ALL NEW FEATURES (one paste for Supabase SQL Editor)
-- =============================================================================
--
-- PREREQUISITE: You must have already run the main quotes/leads schema once:
--   supabase/schema.sql
--
-- This file adds everything new for:
--   • AI Bookkeeper file vault     → /admin/bookkeeper
--   • E-Sign client portal         → /admin/esign + /sign/[token]
--   • B2B prospect finder (Leads)  → /admin/leads
--
-- How to run:
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Paste this ENTIRE file → Run
--   3. Safe to re-run (IF NOT EXISTS / OR REPLACE / ON CONFLICT)
--
-- Vercel / .env.local also needs:
--   SUPABASE_SECRET_KEY (sb_secret_…)
--   RESEND_API_KEY (e-sign emails)
--   SERPAPI_API_KEY (optional, Leads search)
--   GEMINI_API_KEY (optional, portfolio vision for Leads)
--   NEXT_PUBLIC_SITE_URL=https://www.blacktimber.ca
--
-- If quote SAVE still fails after this, also run: supabase/patch-rpc-grants.sql
-- =============================================================================


-- =============================================================================
-- SHARED: updated_at trigger (same as main schema.sql)
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- #############################################################################
-- PART 1 — BOOKKEEPING FILE VAULT (AI Bookkeeper)
-- #############################################################################

do $$
begin
  create type public.file_node_kind as enum ('folder', 'file');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.file_nodes (
  id            uuid primary key default gen_random_uuid(),
  parent_id     uuid references public.file_nodes (id) on delete cascade,
  kind          public.file_node_kind not null,
  name          text not null check (char_length(name) between 1 and 255),
  storage_path  text,
  mime_type     text,
  size_bytes    bigint check (size_bytes is null or size_bytes >= 0),
  text_content  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint file_nodes_sibling_name unique (parent_id, name),
  constraint file_nodes_file_has_path check (
    kind = 'folder'::public.file_node_kind
    or storage_path is not null
    or text_content is not null
  )
);

comment on table public.file_nodes is
  'Admin bookkeeping vault — folder tree + file metadata. Binaries in Storage bucket btc-admin-files.';

create index if not exists file_nodes_parent_idx on public.file_nodes (parent_id);
create index if not exists file_nodes_kind_idx on public.file_nodes (kind);
create index if not exists file_nodes_updated_idx on public.file_nodes (updated_at desc);

drop trigger if exists file_nodes_set_updated_at on public.file_nodes;
create trigger file_nodes_set_updated_at
  before update on public.file_nodes
  for each row execute function public.set_updated_at();

-- Default folders (skip if already present)
insert into public.file_nodes (kind, name, parent_id)
select 'folder'::public.file_node_kind, v.name, null
from (values
  ('Receipts'),
  ('Quotes & Invoices'),
  ('Notes'),
  ('Tax & GST'),
  ('Bank & Deposits'),
  ('Subcontractors')
) as v(name)
where not exists (
  select 1 from public.file_nodes f
  where f.parent_id is null
    and f.kind = 'folder'::public.file_node_kind
    and f.name = v.name
);

-- Private storage bucket for uploads
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'btc-admin-files',
  'btc-admin-files',
  false,
  15728640,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'application/pdf',
    'text/markdown',
    'text/plain',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.file_nodes enable row level security;
revoke all on public.file_nodes from anon, authenticated;
grant all on public.file_nodes to service_role;

create or replace function public.list_file_nodes()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', n.id,
        'parentId', n.parent_id,
        'kind', n.kind::text,
        'name', n.name,
        'mimeType', n.mime_type,
        'sizeBytes', n.size_bytes,
        'hasText', (n.text_content is not null and length(n.text_content) > 0),
        'updatedAt', to_char(timezone('UTC', n.updated_at), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
      )
      order by
        case when n.kind = 'folder' then 0 else 1 end,
        n.name
    ),
    '[]'::jsonb
  )
  from public.file_nodes n;
$$;

grant execute on function public.list_file_nodes() to service_role;

-- Uncomment ONLY if file uploads fail with permission errors:
/*
create policy "service_role_all_btc_admin_files"
on storage.objects for all
to service_role
using (bucket_id = 'btc-admin-files')
with check (bucket_id = 'btc-admin-files');
*/


-- #############################################################################
-- PART 2 — E-SIGN (client signing portal + Resend notifications)
-- #############################################################################

do $$ begin
  create type public.esign_status as enum (
    'draft', 'sent', 'viewed', 'signed', 'void', 'expired'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.esign_event_type as enum (
    'created', 'sent', 'viewed', 'signed', 'voided', 'reminder', 'email_sent', 'email_failed'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.esign_envelopes (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null check (char_length(title) between 1 and 255),
  status              public.esign_status not null default 'draft',
  source_type         text check (source_type is null or source_type in ('quote', 'vault_file', 'custom')),
  source_ref          text,
  signer_name         text not null check (char_length(signer_name) between 1 and 120),
  signer_email        text not null check (signer_email ~* '^[^@]+@[^@]+\.[^@]+$'),
  signer_message      text check (signer_message is null or char_length(signer_message) <= 2000),
  document_snapshot   jsonb not null,
  sign_token_hash     text not null unique,
  expires_at          timestamptz,
  sent_at             timestamptz,
  viewed_at           timestamptz,
  signed_at           timestamptz,
  voided_at           timestamptz,
  signature_data_url  text,
  signer_ip           text,
  signer_user_agent   text,
  consent_accepted_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists esign_envelopes_status_idx on public.esign_envelopes (status, updated_at desc);
create index if not exists esign_envelopes_signer_email_idx on public.esign_envelopes (signer_email);
create index if not exists esign_envelopes_source_ref_idx on public.esign_envelopes (source_ref) where source_ref is not null;

drop trigger if exists esign_envelopes_set_updated_at on public.esign_envelopes;
create trigger esign_envelopes_set_updated_at
  before update on public.esign_envelopes
  for each row execute function public.set_updated_at();

comment on table public.esign_envelopes is
  'Client e-sign envelopes — tokenized portal links, Resend notifications, in-app status.';

create table if not exists public.esign_events (
  id            uuid primary key default gen_random_uuid(),
  envelope_id   uuid not null references public.esign_envelopes (id) on delete cascade,
  event_type    public.esign_event_type not null,
  actor         text not null default 'system',
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists esign_events_envelope_idx on public.esign_events (envelope_id, created_at desc);

alter table public.esign_envelopes enable row level security;
alter table public.esign_events enable row level security;
revoke all on public.esign_envelopes from anon, authenticated;
revoke all on public.esign_events from anon, authenticated;
grant all on public.esign_envelopes to service_role;
grant all on public.esign_events to service_role;


-- #############################################################################
-- PART 3 — B2B PROSPECT LEADS (Admin → Leads tab)
-- #############################################################################

do $$ begin
  create type public.prospect_status as enum (
    'new', 'researching', 'contacted', 'qualified', 'partner', 'passed'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.prospect_search_runs (
  id              uuid primary key default gen_random_uuid(),
  focus           text not null,
  region          text not null default 'East Kootenay, BC',
  summary         text,
  queries_used    text[] not null default '{}',
  raw_payload     jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create table if not exists public.prospect_leads (
  id                  uuid primary key default gen_random_uuid(),
  search_run_id       uuid references public.prospect_search_runs (id) on delete set null,
  company_name        text not null check (char_length(company_name) between 1 and 200),
  website             text,
  location            text,
  prospect_type       text not null default 'other',
  fit_score           smallint not null default 0 check (fit_score between 0 and 100),
  fit_reason          text not null default '',
  collaboration_angle text not null default '',
  suggested_contact   text,
  source_url          text,
  status              public.prospect_status not null default 'new',
  notes               text,
  payload             jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists prospect_leads_status_idx on public.prospect_leads (status, updated_at desc);
create index if not exists prospect_leads_fit_idx on public.prospect_leads (fit_score desc);
create index if not exists prospect_search_runs_created_idx on public.prospect_search_runs (created_at desc);

drop trigger if exists prospect_leads_set_updated_at on public.prospect_leads;
create trigger prospect_leads_set_updated_at
  before update on public.prospect_leads
  for each row execute function public.set_updated_at();

alter table public.prospect_search_runs enable row level security;
alter table public.prospect_leads enable row level security;
revoke all on public.prospect_search_runs from anon, authenticated;
revoke all on public.prospect_leads from anon, authenticated;
grant all on public.prospect_search_runs to service_role;
grant all on public.prospect_leads to service_role;


-- =============================================================================
-- VERIFY (optional — run these one at a time after the script succeeds)
-- =============================================================================
-- Bookkeeper: 6 top-level folders
-- select kind, name from public.file_nodes where parent_id is null order by name;
--
-- Bookkeeper RPC:
-- select jsonb_array_length(public.list_file_nodes());
--
-- E-sign tables exist:
-- select count(*) from public.esign_envelopes;
--
-- Prospect tables exist:
-- select count(*) from public.prospect_leads;
-- =============================================================================
-- DONE
-- =============================================================================
