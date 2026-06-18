-- =============================================================================
-- Black Timber Contracting — Custom email client (Resend-backed) schema
-- =============================================================================
-- Run AFTER supabase/schema.sql. Paste the whole file into the SQL Editor.
--
-- What this gives you (a Gmail-like client on top of Resend):
--   • email_mailboxes      — the addresses/inboxes you own (one per employee or
--                            shared address, all under blacktimber.ca)
--   • email_threads        — conversation grouping per mailbox
--   • email_messages       — every inbound + outbound message, with folder,
--                            star, unread, category, delivery status
--   • email_attachments    — attachment metadata + Supabase Storage pointer
--   • email_events         — Resend deliverability events (delivered/opened/…)
--   • email_webhook_events — svix-id dedup log (webhooks fire at-least-once)
--
-- The Next.js server talks to Supabase with the SERVICE ROLE key only. RLS is
-- enabled and denies anon/authenticated, so nothing is reachable from browsers.
-- Realtime is exposed only via a server-side SSE proxy (also service role), so
-- no row ever reaches a browser without passing the admin session check.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.email_direction as enum ('inbound', 'outbound');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.email_folder as enum (
    'inbox', 'sent', 'drafts', 'archive', 'spam', 'trash'
  );
exception when duplicate_object then null; end $$;

-- Gmail-style inbox tabs for inbound mail. Outbound is always 'primary'.
do $$ begin
  create type public.email_category as enum (
    'primary', 'promotions', 'social', 'updates', 'forums'
  );
exception when duplicate_object then null; end $$;

-- Mirrors Resend's last_event values + a local 'received' for inbound.
do $$ begin
  create type public.email_status as enum (
    'received', 'draft', 'queued', 'scheduled', 'sent', 'delivered',
    'delivery_delayed', 'opened', 'clicked', 'bounced', 'complained',
    'failed', 'suppressed', 'canceled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.email_mailbox_kind as enum ('shared', 'personal');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Reuse set_updated_at() from schema.sql; define defensively if run alone.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- MAILBOXES — every address we can send-from / receive-into
-- -----------------------------------------------------------------------------
create table if not exists public.email_mailboxes (
  id            uuid primary key default gen_random_uuid(),
  -- Full address, lowercased, e.g. jaryd@blacktimber.ca
  address       text not null unique
    check (address = lower(address) and address ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  display_name  text not null check (char_length(display_name) between 1 and 120),
  kind          public.email_mailbox_kind not null default 'personal',
  -- 'personal' inboxes belong to one employee; 'shared' (info@, hello@) is team.
  owner_label   text check (owner_label is null or char_length(owner_label) <= 120),
  description   text check (description is null or char_length(description) <= 400),
  -- Signature appended to composed mail (HTML).
  signature_html text check (signature_html is null or char_length(signature_html) <= 8000),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists email_mailboxes_active_idx
  on public.email_mailboxes (active, address);

drop trigger if exists email_mailboxes_set_updated_at on public.email_mailboxes;
create trigger email_mailboxes_set_updated_at
  before update on public.email_mailboxes
  for each row execute function public.set_updated_at();

comment on table public.email_mailboxes is
  'Addresses under blacktimber.ca that the client sends from / receives into.';

-- -----------------------------------------------------------------------------
-- THREADS — conversation grouping (per mailbox)
-- -----------------------------------------------------------------------------
create table if not exists public.email_threads (
  id              uuid primary key default gen_random_uuid(),
  mailbox_id      uuid not null references public.email_mailboxes (id) on delete cascade,
  -- Subject with leading Re:/Fwd: stripped, used to coalesce replies.
  subject_norm    text not null default '',
  subject         text not null default '',
  snippet         text not null default '',
  last_message_at timestamptz not null default now(),
  message_count   integer not null default 0,
  unread_count    integer not null default 0,
  has_attachments boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists email_threads_mailbox_idx
  on public.email_threads (mailbox_id, last_message_at desc);

drop trigger if exists email_threads_set_updated_at on public.email_threads;
create trigger email_threads_set_updated_at
  before update on public.email_threads
  for each row execute function public.set_updated_at();

comment on table public.email_threads is
  'Conversation grouping per mailbox; replies coalesce by normalized subject + Message-ID chain.';

-- -----------------------------------------------------------------------------
-- MESSAGES — inbound + outbound
-- -----------------------------------------------------------------------------
create table if not exists public.email_messages (
  id              uuid primary key default gen_random_uuid(),
  mailbox_id      uuid not null references public.email_mailboxes (id) on delete cascade,
  thread_id       uuid references public.email_threads (id) on delete set null,

  direction       public.email_direction not null,
  folder          public.email_folder not null default 'inbox',
  category        public.email_category not null default 'primary',
  status          public.email_status not null default 'received',

  -- Resend identifiers. For inbound: the receiving email id. For outbound: the
  -- send id returned by POST /emails. Used to correlate webhook events.
  resend_id       text,
  -- RFC 5322 Message-ID header (e.g. <abc@blacktimber.ca>) for threading.
  rfc_message_id  text,
  in_reply_to     text,
  ref_ids         text[] not null default '{}',

  from_address    text not null,
  from_name       text,
  to_addresses    text[] not null default '{}',
  cc_addresses    text[] not null default '{}',
  bcc_addresses   text[] not null default '{}',
  reply_to        text,

  subject         text not null default '',
  snippet         text not null default '',
  body_html       text,
  body_text       text,

  has_attachments boolean not null default false,
  starred         boolean not null default false,
  unread          boolean not null default true,
  tags            jsonb not null default '{}'::jsonb,

  -- Raw .eml download (signed, expires) from the Receiving API.
  raw_url         text,
  raw_url_expires_at timestamptz,

  -- Date the message was sent/received (from the email), distinct from row insert.
  email_date      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists email_messages_resend_dir_idx
  on public.email_messages (resend_id, direction)
  where resend_id is not null;
create index if not exists email_messages_mailbox_folder_idx
  on public.email_messages (mailbox_id, folder, email_date desc);
create index if not exists email_messages_thread_idx
  on public.email_messages (thread_id, email_date);
create index if not exists email_messages_unread_idx
  on public.email_messages (mailbox_id, folder) where unread;
create index if not exists email_messages_rfc_id_idx
  on public.email_messages (rfc_message_id) where rfc_message_id is not null;

drop trigger if exists email_messages_set_updated_at on public.email_messages;
create trigger email_messages_set_updated_at
  before update on public.email_messages
  for each row execute function public.set_updated_at();

comment on table public.email_messages is
  'Every inbound + outbound message. folder/category/star/unread are app-managed (Resend has no folders).';

-- -----------------------------------------------------------------------------
-- ATTACHMENTS
-- -----------------------------------------------------------------------------
create table if not exists public.email_attachments (
  id              uuid primary key default gen_random_uuid(),
  message_id      uuid not null references public.email_messages (id) on delete cascade,
  -- Resend's attachment id (inbound) for re-fetching a fresh signed URL.
  resend_attachment_id text,
  filename        text,
  content_type    text not null default 'application/octet-stream',
  size_bytes      bigint not null default 0,
  -- For inline images referenced in HTML via cid:
  content_id      text,
  content_disposition text not null default 'attachment',
  -- Persisted copy in Supabase Storage (bucket: email-attachments).
  storage_path    text,
  -- Cached signed download URL from Resend (valid ~1h); refresh on demand.
  download_url    text,
  download_url_expires_at timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists email_attachments_message_idx
  on public.email_attachments (message_id);

comment on table public.email_attachments is
  'Attachment metadata; binaries live in Supabase Storage (email-attachments bucket) or via Resend signed URL.';

-- -----------------------------------------------------------------------------
-- DELIVERABILITY EVENTS (delivered / opened / clicked / bounced / complained)
-- -----------------------------------------------------------------------------
create table if not exists public.email_events (
  id              uuid primary key default gen_random_uuid(),
  message_id      uuid references public.email_messages (id) on delete set null,
  resend_email_id text,
  event_type      text not null,
  payload         jsonb not null default '{}'::jsonb,
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists email_events_message_idx
  on public.email_events (message_id, occurred_at desc);
create index if not exists email_events_resend_idx
  on public.email_events (resend_email_id);

comment on table public.email_events is
  'Resend webhook deliverability events; sorted by occurred_at (events can arrive out of order).';

-- -----------------------------------------------------------------------------
-- WEBHOOK DEDUP — svix-id is unique per delivery attempt of an event
-- -----------------------------------------------------------------------------
create table if not exists public.email_webhook_events (
  svix_id      text primary key,
  event_type   text,
  received_at  timestamptz not null default now()
);

comment on table public.email_webhook_events is
  'Dedup log: insert svix-id; a conflict means we already processed this delivery.';

-- -----------------------------------------------------------------------------
-- RPC: atomically recompute thread rollups (count, unread, snippet, last date)
-- -----------------------------------------------------------------------------
create or replace function public.email_recalc_thread(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.email_threads t set
    message_count = sub.cnt,
    unread_count = sub.unread,
    has_attachments = sub.has_att,
    last_message_at = sub.last_at,
    subject = coalesce(sub.last_subject, t.subject),
    snippet = coalesce(sub.last_snippet, t.snippet)
  from (
    select
      count(*)::int as cnt,
      count(*) filter (where m.unread and m.folder <> 'trash')::int as unread,
      bool_or(m.has_attachments) as has_att,
      max(m.email_date) as last_at,
      (array_agg(m.subject order by m.email_date desc))[1] as last_subject,
      (array_agg(m.snippet order by m.email_date desc))[1] as last_snippet
    from public.email_messages m
    where m.thread_id = p_thread_id
      and m.folder <> 'trash'
  ) sub
  where t.id = p_thread_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: folder counts for the sidebar (unread per folder for a mailbox)
-- -----------------------------------------------------------------------------
create or replace function public.email_folder_counts(p_mailbox_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(folder, counts), '{}'::jsonb)
  from (
    select
      folder::text as folder,
      jsonb_build_object(
        'total', count(*),
        'unread', count(*) filter (where unread)
      ) as counts
    from public.email_messages
    where mailbox_id = p_mailbox_id
    group by folder
  ) t;
$$;

-- -----------------------------------------------------------------------------
-- Storage bucket for attachments (private)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('email-attachments', 'email-attachments', false)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Realtime — let the server-side SSE proxy subscribe to message changes
-- -----------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.email_messages;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.email_threads;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Row Level Security — deny all; service_role bypasses RLS
-- -----------------------------------------------------------------------------
alter table public.email_mailboxes enable row level security;
alter table public.email_threads enable row level security;
alter table public.email_messages enable row level security;
alter table public.email_attachments enable row level security;
alter table public.email_events enable row level security;
alter table public.email_webhook_events enable row level security;

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on function public.email_recalc_thread(uuid) to service_role;
grant execute on function public.email_folder_counts(uuid) to service_role;

revoke all on public.email_mailboxes from anon, authenticated;
revoke all on public.email_threads from anon, authenticated;
revoke all on public.email_messages from anon, authenticated;
revoke all on public.email_attachments from anon, authenticated;
revoke all on public.email_events from anon, authenticated;
revoke all on public.email_webhook_events from anon, authenticated;

-- =============================================================================
-- DONE. Next steps:
--   1. Verify blacktimber.ca for sending + add the Receiving MX record in Resend.
--   2. Create a webhook in Resend → events: email.received, email.sent,
--      email.delivered, email.opened, email.clicked, email.bounced,
--      email.complained, email.failed. Endpoint: https://YOURHOST/api/email/webhook
--   3. Copy the webhook Signing Secret → RESEND_WEBHOOK_SECRET in env.
--   4. Seed at least one mailbox, e.g.:
--        insert into public.email_mailboxes (address, display_name, kind)
--        values ('hello@blacktimber.ca', 'Black Timber', 'shared');
--      (or create them from the Inbox UI once deployed)
-- =============================================================================
