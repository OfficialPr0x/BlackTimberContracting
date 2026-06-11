-- Site leads CRM extensions (run after supabase/schema.sql)
-- Adds status, tags, notes for marketing-site inquiry pipeline.

alter table public.leads
  add column if not exists status text not null default 'new'
    check (status in ('new', 'estimate', 'booked', 'contacted', 'won', 'lost'));

alter table public.leads
  add column if not exists tags text[] not null default '{}';

alter table public.leads
  add column if not exists notes text;

create index if not exists leads_status_idx on public.leads (status, created_at desc);
create index if not exists leads_tags_gin on public.leads using gin (tags);

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

grant execute on function public.insert_lead(
  public.lead_source, text, text, text, text, jsonb, boolean, boolean, boolean, text[]
) to service_role;

grant execute on function public.update_site_lead(uuid, text, text[], text) to service_role;
