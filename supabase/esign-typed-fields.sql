-- =============================================================================
-- Black Timber Contracting — E-SIGN upgrade
-- Branded slugs · document numbers · typed (enterprise) signature fields
-- =============================================================================
-- Run AFTER esign-schema.sql in the Supabase SQL Editor. Idempotent.
-- =============================================================================

alter table public.esign_envelopes
  add column if not exists slug             text,
  add column if not exists document_number  text,
  add column if not exists signature_fields jsonb,
  add column if not exists require_address  boolean not null default false;

-- Branded signing link identifier (e.g. bt-xxxxxxxxxxxxxxxxxxxxxxxx). Unique,
-- high-entropy → it is itself the bearer credential for /sign/<slug>.
create unique index if not exists esign_envelopes_slug_idx
  on public.esign_envelopes (slug) where slug is not null;

-- Human reference shown on emails / portal / certificate (e.g. BT-2026-AB3CD).
create index if not exists esign_envelopes_document_number_idx
  on public.esign_envelopes (document_number) where document_number is not null;

comment on column public.esign_envelopes.slug is
  'Branded, unguessable public signing link id used in /sign/<slug>.';
comment on column public.esign_envelopes.document_number is
  'Human-friendly document reference (BT-YYYY-XXXXX) for emails + certificate.';
comment on column public.esign_envelopes.signature_fields is
  'Typed signature capture: legal name, title, company, address, date, font, consent text.';

-- =============================================================================
-- DONE
-- =============================================================================
