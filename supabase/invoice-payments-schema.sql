-- Invoice payment tracking (Cash · E-Transfer · Credit Card)
-- Run in Supabase SQL Editor after schema.sql. Safe to re-run.

do $$ begin
  create type public.payment_method as enum ('cash', 'e_transfer', 'credit_card');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.invoice_payments (
  id            uuid primary key default gen_random_uuid(),
  document_id   text not null references public.documents (id) on delete cascade,
  amount_cad    numeric(12,2) not null check (amount_cad > 0 and amount_cad <= 1000000),
  method        public.payment_method not null,
  paid_at       date not null default (current_date),
  notes         text check (notes is null or char_length(notes) <= 500),
  created_at    timestamptz not null default now(),
  created_by    text not null default 'admin'
);

create index if not exists invoice_payments_document_idx
  on public.invoice_payments (document_id, paid_at desc);

comment on table public.invoice_payments is
  'Partial or full payments recorded against I- invoices.';

alter table public.invoice_payments enable row level security;
revoke all on public.invoice_payments from anon, authenticated;
grant all on public.invoice_payments to service_role;
