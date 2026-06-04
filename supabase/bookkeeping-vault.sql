-- =============================================================================
-- Black Timber Contracting — BOOKKEEPING FILE VAULT (full script)
-- =============================================================================
-- Paste this ENTIRE file into: Supabase Dashboard → SQL Editor → New query → Run
--
-- Powers: /admin/bookkeeper — folders, receipts, photos, PDF, Excel, markdown
--         notes, AI bookkeeper with vision on open files.
--
-- Requires on Vercel / .env.local:
--   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
--   SUPABASE_SECRET_KEY (sb_secret_…) — NOT the publishable key
--
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE / ON CONFLICT where possible.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Prerequisite: updated_at trigger helper (from main schema.sql)
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
-- 1. Enum: folder vs file
-- -----------------------------------------------------------------------------
do $$
begin
  create type public.file_node_kind as enum ('folder', 'file');
exception
  when duplicate_object then null;
end;
$$;


-- -----------------------------------------------------------------------------
-- 2. Table: file tree (folders + file metadata)
-- -----------------------------------------------------------------------------
create table if not exists public.file_nodes (
  id            uuid primary key default gen_random_uuid(),
  parent_id     uuid references public.file_nodes (id) on delete cascade,
  kind          public.file_node_kind not null,
  name          text not null check (char_length(name) between 1 and 255),
  -- Supabase Storage path inside bucket btc-admin-files, e.g. {uuid}/{filename}
  storage_path  text,
  mime_type     text,
  size_bytes    bigint check (size_bytes is null or size_bytes >= 0),
  -- Markdown / notes edited in the Bookkeeper IDE (optional)
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
  'Admin bookkeeping vault — folder tree + file metadata. Binaries live in Storage bucket btc-admin-files.';

create index if not exists file_nodes_parent_idx on public.file_nodes (parent_id);
create index if not exists file_nodes_kind_idx on public.file_nodes (kind);
create index if not exists file_nodes_updated_idx on public.file_nodes (updated_at desc);

drop trigger if exists file_nodes_set_updated_at on public.file_nodes;
create trigger file_nodes_set_updated_at
  before update on public.file_nodes
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 3. Default top-level folders (idempotent)
-- -----------------------------------------------------------------------------
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


-- -----------------------------------------------------------------------------
-- 4. Storage bucket (private) — receipts, PDFs, images, spreadsheets
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'btc-admin-files',
  'btc-admin-files',
  false,
  15728640,  -- 15 MB per file
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


-- -----------------------------------------------------------------------------
-- 5. Row Level Security — lock down browser keys; server uses secret (bypasses RLS)
-- -----------------------------------------------------------------------------
alter table public.file_nodes enable row level security;

-- No policies for anon/authenticated → only service_role can read/write.
-- (service_role bypasses RLS by default in Supabase)

revoke all on public.file_nodes from anon, authenticated;
grant all on public.file_nodes to service_role;


-- -----------------------------------------------------------------------------
-- 6. RPC: list entire file tree (app builds nested folders client-side)
-- -----------------------------------------------------------------------------
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

comment on function public.list_file_nodes() is
  'Returns flat JSON array of all vault nodes for /api/admin/files.';

grant execute on function public.list_file_nodes() to service_role;


-- -----------------------------------------------------------------------------
-- 7. Optional: storage policies (only if uploads fail with permission errors)
--     The service_role key normally bypasses storage RLS. Uncomment if needed.
-- -----------------------------------------------------------------------------
/*
create policy "service_role_all_btc_admin_files"
on storage.objects for all
to service_role
using (bucket_id = 'btc-admin-files')
with check (bucket_id = 'btc-admin-files');
*/


-- -----------------------------------------------------------------------------
-- 8. Verify (should return 6 folders + list_file_nodes JSON)
-- -----------------------------------------------------------------------------
-- select kind, name from public.file_nodes where parent_id is null order by name;
-- select public.list_file_nodes();

-- =============================================================================
-- DONE — Bookkeeping vault ready.
--
-- Next:
--   1. Vercel → SUPABASE_SECRET_KEY + SUPABASE_URL
--   2. Redeploy app
--   3. Open https://www.blacktimber.ca/admin/bookkeeper
-- =============================================================================
