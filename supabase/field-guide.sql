-- =============================================================================
-- Black Timber Field Guide — password-protected e-guide subscribers
-- Run in Supabase SQL Editor (safe to re-run)
-- =============================================================================

create table if not exists public.guide_subscribers (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(name) between 2 and 120),
  email               text not null check (char_length(email) <= 200),
  password_hash       text not null,
  guide_slug          text not null default 'kootenay-field-guide',
  lead_id             uuid,
  welcome_email_sent  boolean not null default false,
  welcome_email_error text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (email, guide_slug)
);

create index if not exists guide_subscribers_email_idx
  on public.guide_subscribers (lower(email));

create index if not exists guide_subscribers_created_idx
  on public.guide_subscribers (created_at desc);

comment on table public.guide_subscribers is
  'Exit-intent and marketing signups for password-protected field guides.';

alter table public.guide_subscribers enable row level security;
revoke all on public.guide_subscribers from anon, authenticated;
grant all on public.guide_subscribers to service_role;

-- Optional link to marketing leads table (no FK if leads missing)
do $$ begin
  alter table public.guide_subscribers
    add constraint guide_subscribers_lead_id_fkey
    foreign key (lead_id) references public.leads (id) on delete set null;
exception
  when duplicate_object then null;
  when undefined_table then null;
end $$;
