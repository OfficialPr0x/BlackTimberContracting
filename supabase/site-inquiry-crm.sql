-- =============================================================================
-- Black Timber — Site Inquiry CRM (paste entire file into Supabase SQL Editor)
-- =============================================================================
-- Powers:
--   • Exit-intent email popup (source: exit_intent)
--   • Quote wizard AI estimates   (source: quote_wizard, stage: estimate_generated)
--   • Consultation bookings       (source: quote_wizard, stage: booked)
--   • Property intel / other site forms (site_intel_report, footer, etc.)
--
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE throughout.
-- Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in your Next.js env.
-- Admin UI: /admin/leads → Site CRM tab
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- lead_source enum (matches src/lib/openrouter/schemas.ts LeadInput.source)
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.lead_source as enum (
    'quote_wizard',
    'site_intel_report',
    'explain_price',
    'concierge_chat',
    'exit_intent',
    'footer'
  );
exception
  when duplicate_object then null;
end $$;

-- -----------------------------------------------------------------------------
-- leads table — core capture + CRM columns
-- -----------------------------------------------------------------------------
create table if not exists public.leads (
  id               uuid primary key default gen_random_uuid(),
  source           public.lead_source not null,
  name             text not null check (char_length(name) between 2 and 120),
  email            text not null check (char_length(email) <= 200),
  phone            text check (phone is null or char_length(phone) between 7 and 40),
  address          text check (address is null or char_length(address) <= 300),
  payload          jsonb not null default '{}'::jsonb,
  delivered_file   boolean not null default true,
  delivered_email  boolean not null default false,
  delivered_slack  boolean not null default false,
  delivery_errors  text[] not null default '{}',
  created_at       timestamptz not null default now()
);

comment on table public.leads is
  'Marketing-site inquiries: exit-intent signups, quote wizard estimates/bookings, site intel, etc.';

comment on column public.leads.payload is
  'JSON blob from the app. Examples:
   exit_intent  → { tags, offer, page }
   quote_wizard → { stage, sessionId, tags, estimateDocument, aiQuote, preferredDate, preferredTime, projectType, dimensions, ... }';

-- CRM pipeline columns (admin Site CRM tab)
alter table public.leads
  add column if not exists status text not null default 'new';

-- Add check constraint only if missing (re-run safe)
do $$ begin
  alter table public.leads
    add constraint leads_status_check
    check (status in ('new', 'estimate', 'booked', 'contacted', 'won', 'lost'));
exception
  when duplicate_object then null;
end $$;

alter table public.leads
  add column if not exists tags text[] not null default '{}';

alter table public.leads
  add column if not exists notes text;

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_source_idx on public.leads (source);
create index if not exists leads_email_idx on public.leads (lower(email));
create index if not exists leads_status_idx on public.leads (status, created_at desc);
create index if not exists leads_tags_gin on public.leads using gin (tags);

-- Fast lookup: quote wizard sessions (estimate + booking pairs)
create index if not exists leads_payload_session_idx
  on public.leads ((payload->>'sessionId'))
  where payload ? 'sessionId';

create index if not exists leads_payload_stage_idx
  on public.leads ((payload->>'stage'))
  where payload ? 'stage';

-- -----------------------------------------------------------------------------
-- RPC: insert_lead — called by POST /api/leads → deliverLead() → insertSiteLead()
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
-- RPC: update_site_lead — status / tags / notes (admin CRM + post-insert tagging)
-- -----------------------------------------------------------------------------
create or replace function public.update_site_lead(
  p_id uuid,
  p_status text default null,
  p_tags text[] default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.leads
  set
    status = coalesce(p_status, status),
    tags = coalesce(p_tags, tags),
    notes = coalesce(p_notes, notes)
  where id = p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Security: RLS on, no public policies (service_role only via Next.js server)
-- -----------------------------------------------------------------------------
alter table public.leads enable row level security;

revoke all on public.leads from anon, authenticated;
grant all on public.leads to service_role;

grant execute on function public.insert_lead(
  public.lead_source, text, text, text, text, jsonb, boolean, boolean, boolean, text[]
) to service_role;

grant execute on function public.update_site_lead(uuid, text, text[], text) to service_role;

-- -----------------------------------------------------------------------------
-- VERIFY (optional — run after the script succeeds)
-- -----------------------------------------------------------------------------
-- Table + CRM columns:
--   select column_name, data_type
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'leads'
--   order by ordinal_position;
--
-- Recent site inquiries:
--   select id, source, name, email, status, tags, payload->>'stage' as stage, created_at
--   from public.leads
--   order by created_at desc
--   limit 20;
--
-- Exit-intent signups only:
--   select * from public.leads where source = 'exit_intent' order by created_at desc limit 10;
--
-- Quote wizard bookings only:
--   select * from public.leads
--   where source = 'quote_wizard' and payload->>'stage' = 'booked'
--   order by created_at desc limit 10;
-- =============================================================================
-- DONE
-- =============================================================================
