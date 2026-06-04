-- Run this in Supabase SQL Editor if saves fail but the secret key is set.
-- Safe to run multiple times.

create or replace function public.upsert_document(
  p_document jsonb,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_line jsonb;
  v_sort int := 0;
begin
  v_id := p_document->>'id';

  insert into public.documents (
    id, document_type, status,
    customer_name, customer_email, customer_phone,
    customer_billing_address, customer_job_site_address,
    project_type, project_scope_summary,
    project_length_ft, project_width_ft, project_material, project_notes,
    tax_mode, freight_cad, valid_until,
    internal_notes, payment_terms, payment_instructions,
    subtotal_cad, gst_cad, pst_cad, grand_total_cad, max_lead_time_days,
    created_at, updated_at, created_by
  )
  values (
    v_id,
    (p_document->>'documentType')::public.document_type,
    (p_document->>'status')::public.document_status,
    p_document->'customer'->>'name',
    nullif(p_document->'customer'->>'email', ''),
    nullif(p_document->'customer'->>'phone', ''),
    nullif(p_document->'customer'->>'billingAddress', ''),
    nullif(p_document->'customer'->>'jobSiteAddress', ''),
    (p_document->'project'->>'type')::public.project_type,
    p_document->'project'->>'scopeSummary',
    nullif(trim(p_document->'project'->>'lengthFt'), '')::numeric,
    nullif(trim(p_document->'project'->>'widthFt'), '')::numeric,
    nullif(p_document->'project'->>'material', ''),
    nullif(p_document->'project'->>'notes', ''),
    (p_document->>'taxMode')::public.tax_mode,
    coalesce((p_document->>'freightCAD')::numeric, 0),
    (p_document->>'validUntil')::date,
    nullif(p_document->>'internalNotes', ''),
    nullif(p_document->>'paymentTerms', ''),
    nullif(p_document->>'paymentInstructions', ''),
    (p_document->'totals'->>'subtotalCAD')::numeric,
    (p_document->'totals'->>'gstCAD')::numeric,
    (p_document->'totals'->>'pstCAD')::numeric,
    (p_document->'totals'->>'grandTotalCAD')::numeric,
    coalesce((p_document->'totals'->>'maxLeadTimeDays')::integer, 0),
    coalesce((p_document->>'createdAt')::timestamptz, now()),
    coalesce((p_document->>'updatedAt')::timestamptz, now()),
    coalesce(p_document->>'createdBy', 'admin')
  )
  on conflict (id) do update set
    document_type = excluded.document_type,
    status = excluded.status,
    customer_name = excluded.customer_name,
    customer_email = excluded.customer_email,
    customer_phone = excluded.customer_phone,
    customer_billing_address = excluded.customer_billing_address,
    customer_job_site_address = excluded.customer_job_site_address,
    project_type = excluded.project_type,
    project_scope_summary = excluded.project_scope_summary,
    project_length_ft = excluded.project_length_ft,
    project_width_ft = excluded.project_width_ft,
    project_material = excluded.project_material,
    project_notes = excluded.project_notes,
    tax_mode = excluded.tax_mode,
    freight_cad = excluded.freight_cad,
    valid_until = excluded.valid_until,
    internal_notes = excluded.internal_notes,
    payment_terms = excluded.payment_terms,
    payment_instructions = excluded.payment_instructions,
    subtotal_cad = excluded.subtotal_cad,
    gst_cad = excluded.gst_cad,
    pst_cad = excluded.pst_cad,
    grand_total_cad = excluded.grand_total_cad,
    max_lead_time_days = excluded.max_lead_time_days,
    updated_at = excluded.updated_at,
    created_by = excluded.created_by;

  delete from public.document_lines where document_id = v_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    insert into public.document_lines (
      id, document_id, sort_order,
      description, quantity, uom, unit_price_cad,
      source, lead_time_days, notes
    )
    values (
      v_line->>'id',
      v_id,
      v_sort,
      v_line->>'description',
      coalesce((v_line->>'quantity')::numeric, 1),
      coalesce((v_line->>'uom')::public.line_uom, 'EA'),
      coalesce((v_line->>'unitPriceCAD')::numeric, 0),
      coalesce((v_line->>'source')::public.line_source, 'other'),
      nullif(trim(v_line->>'leadTimeDays'), '')::integer,
      nullif(v_line->>'notes', '')
    );
    v_sort := v_sort + 1;
  end loop;

  insert into public.document_revisions (document_id, snapshot)
  values (v_id, p_document);

  return p_document;
end;
$$;

grant execute on function public.upsert_document(jsonb, jsonb) to service_role;
grant execute on function public.get_document(text) to service_role;
grant execute on function public.list_documents(integer) to service_role;
