-- =============================================================================
-- Black Timber — Admin file vault (run AFTER schema.sql)
-- Supabase Dashboard → SQL Editor → paste & Run
-- Also create bucket: Storage → New bucket → btc-admin-files (private)
-- =============================================================================

create type public.file_node_kind as enum ('folder', 'file');

create table if not exists public.file_nodes (
  id            uuid primary key default gen_random_uuid(),
  parent_id     uuid references public.file_nodes (id) on delete cascade,
  kind          public.file_node_kind not null,
  name          text not null check (char_length(name) between 1 and 255),
  storage_path  text,
  mime_type     text,
  size_bytes    bigint check (size_bytes is null or size_bytes >= 0),
  -- Inline markdown / notes edited in the IDE (optional; files also in Storage)
  text_content  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint file_nodes_sibling_name unique (parent_id, name),
  constraint file_nodes_file_has_path check (
    kind = 'folder' or storage_path is not null or text_content is not null
  )
);

create index if not exists file_nodes_parent_idx on public.file_nodes (parent_id);
create index if not exists file_nodes_kind_idx on public.file_nodes (kind);

drop trigger if exists file_nodes_set_updated_at on public.file_nodes;
create trigger file_nodes_set_updated_at
  before update on public.file_nodes
  for each row execute function public.set_updated_at();

-- Default folders (idempotent)
insert into public.file_nodes (kind, name, parent_id)
select 'folder', v.name, null
from (values
  ('Receipts'),
  ('Quotes & Invoices'),
  ('Notes'),
  ('Tax & GST')
) as v(name)
where not exists (
  select 1 from public.file_nodes f
  where f.parent_id is null and f.kind = 'folder' and f.name = v.name
);

-- Storage bucket (private — server uses service role)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'btc-admin-files',
  'btc-admin-files',
  false,
  15728640,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
    'application/pdf',
    'text/markdown', 'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
)
on conflict (id) do nothing;

alter table public.file_nodes enable row level security;
grant all on public.file_nodes to service_role;

-- Flat tree for the app (build nested client-side)
create or replace function public.list_file_nodes()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', n.id,
      'parentId', n.parent_id,
      'kind', n.kind,
      'name', n.name,
      'mimeType', n.mime_type,
      'sizeBytes', n.size_bytes,
      'hasText', (n.text_content is not null),
      'updatedAt', to_char(timezone('UTC', n.updated_at), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    ) order by n.kind desc, n.name
  ), '[]'::jsonb)
  from public.file_nodes n;
$$;

grant execute on function public.list_file_nodes() to service_role;
