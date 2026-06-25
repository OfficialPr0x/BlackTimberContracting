-- =============================================================================
-- Black Timber Contracting — QR CODES (saveable + scan tracking)
-- =============================================================================
-- Run after schema.sql in the Supabase SQL Editor.
-- Requires: SUPABASE_SECRET_KEY (service role) on Vercel.
--
-- Public QR codes encode a short tracking link (/r/<slug>). Each scan is
-- recorded as a row in qr_scans and bumps the counter on qr_codes, then the
-- visitor is 302-redirected to the chosen destination.
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.qr_codes (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (char_length(slug) between 3 and 64),
  label         text not null check (char_length(label) between 1 and 160),
  destination   text not null check (char_length(destination) between 1 and 2048),
  scan_count    integer not null default 0,
  last_scan_at  timestamptz,
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists qr_codes_created_idx on public.qr_codes (created_at desc);
create index if not exists qr_codes_active_idx on public.qr_codes (archived, created_at desc);

drop trigger if exists qr_codes_set_updated_at on public.qr_codes;
create trigger qr_codes_set_updated_at
  before update on public.qr_codes
  for each row execute function public.set_updated_at();

comment on table public.qr_codes is
  'Saveable branded QR codes. Each encodes /r/<slug>; scans tracked in qr_scans.';

create table if not exists public.qr_scans (
  id          uuid primary key default gen_random_uuid(),
  qr_id       uuid not null references public.qr_codes (id) on delete cascade,
  user_agent  text,
  referer     text,
  ip_hash     text,
  created_at  timestamptz not null default now()
);

create index if not exists qr_scans_qr_idx on public.qr_scans (qr_id, created_at desc);
create index if not exists qr_scans_unique_idx on public.qr_scans (qr_id, ip_hash);

comment on table public.qr_scans is
  'One row per QR scan/redirect — used for total + unique (per ip_hash) counts.';

-- Aggregated stats for the admin list (total scans + unique devices).
create or replace view public.qr_code_stats as
select
  c.id,
  c.slug,
  c.label,
  c.destination,
  c.archived,
  c.scan_count,
  c.last_scan_at,
  c.created_at,
  c.updated_at,
  count(s.id)                                                    as total_scans,
  count(distinct s.ip_hash) filter (where s.ip_hash is not null) as unique_scans
from public.qr_codes c
left join public.qr_scans s on s.qr_id = c.id
group by c.id;

-- Atomic scan recorder: logs the hit, bumps the counter, returns the
-- destination (or null if the slug is unknown / archived).
create or replace function public.record_qr_scan(
  p_slug       text,
  p_user_agent text default null,
  p_referer    text default null,
  p_ip_hash    text default null
) returns text
language plpgsql
as $$
declare
  v_id          uuid;
  v_destination text;
begin
  select id, destination into v_id, v_destination
  from public.qr_codes
  where slug = p_slug and archived = false
  limit 1;

  if v_id is null then
    return null;
  end if;

  insert into public.qr_scans (qr_id, user_agent, referer, ip_hash)
  values (v_id, p_user_agent, p_referer, p_ip_hash);

  update public.qr_codes
  set scan_count = scan_count + 1,
      last_scan_at = now()
  where id = v_id;

  return v_destination;
end;
$$;

-- Service role only — the app talks to Supabase with the secret key.
alter table public.qr_codes enable row level security;
alter table public.qr_scans enable row level security;

revoke all on public.qr_codes from anon, authenticated;
revoke all on public.qr_scans from anon, authenticated;
grant all on public.qr_codes to service_role;
grant all on public.qr_scans to service_role;
grant select on public.qr_code_stats to service_role;
grant execute on function public.record_qr_scan(text, text, text, text) to service_role;

-- =============================================================================
-- DONE — wire app: /admin/qr (generator + list), /r/[slug] (public redirect)
-- =============================================================================
