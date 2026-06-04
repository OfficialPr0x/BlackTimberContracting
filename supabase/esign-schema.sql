-- =============================================================================
-- Black Timber Contracting — E-SIGN (proprietary signing portal)
-- =============================================================================
-- Run after schema.sql + bookkeeping-vault.sql in Supabase SQL Editor.
-- Requires: SUPABASE_SECRET_KEY, RESEND_API_KEY, SITE_URL on Vercel
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

-- =============================================================================
-- DONE — wire app: /admin/esign, /sign/[token], POST sync-quotes optional
-- =============================================================================
