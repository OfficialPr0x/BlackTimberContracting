/**
 * Normalize AdminQuoteSaved before upsert_document RPC — avoids Postgres
 * cast errors from empty strings (e.g. ""::numeric).
 */

import type { AdminQuoteSaved } from "./schemas";

function finiteOrUndefined(n: unknown): number | undefined {
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
  return n;
}

export function sanitizeDocumentForRpc(record: AdminQuoteSaved): AdminQuoteSaved {
  const project = { ...record.project };
  const lengthFt = finiteOrUndefined(project.lengthFt);
  const widthFt = finiteOrUndefined(project.widthFt);
  if (lengthFt === undefined) delete project.lengthFt;
  else project.lengthFt = lengthFt;
  if (widthFt === undefined) delete project.widthFt;
  else project.widthFt = widthFt;

  const customer = { ...record.customer };
  if (customer.email === "") delete customer.email;
  if (customer.phone === "") delete customer.phone;
  if (customer.billingAddress === "") delete customer.billingAddress;
  if (customer.jobSiteAddress === "") delete customer.jobSiteAddress;

  const lines = record.lines.map((line) => {
    const out = { ...line };
    if (out.notes === "" || out.notes == null) delete out.notes;
    const ltd = finiteOrUndefined(out.leadTimeDays);
    if (ltd === undefined) delete out.leadTimeDays;
    else out.leadTimeDays = Math.round(ltd);
    return out;
  });

  return {
    ...record,
    customer,
    project,
    lines,
    internalNotes: record.internalNotes?.trim() || undefined,
    paymentTerms: record.paymentTerms?.trim() || undefined,
    paymentInstructions: record.paymentInstructions?.trim() || undefined,
  };
}
