-- =============================================================================
-- Black Timber — B2B PROSPECT LEADS (admin Lead Gen tab)
-- =============================================================================
-- Run in Supabase SQL Editor after schema.sql
-- =============================================================================

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
