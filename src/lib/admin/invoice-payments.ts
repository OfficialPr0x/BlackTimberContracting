import "server-only";

import { AiError } from "@/lib/openrouter/errors";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import type {
  InvoicePayment,
  InvoicePaymentInput,
  InvoicePaymentMethod,
  InvoicePaymentSummary,
} from "./schemas";

function requireSb() {
  if (!isSupabaseConfigured()) {
    throw new AiError({
      code: "internal",
      status: 503,
      clientMessage:
        "Payment tracking needs Supabase. Run supabase/invoice-payments-schema.sql and set SUPABASE_SECRET_KEY.",
      message: "Supabase not configured",
    });
  }
  const sb = getSupabaseAdmin();
  if (!sb) {
    throw new AiError({
      code: "internal",
      status: 503,
      clientMessage: "Database client unavailable.",
      message: "Supabase admin null",
    });
  }
  return sb;
}

function rowToPayment(row: {
  id: string;
  document_id: string;
  amount_cad: number | string;
  method: string;
  paid_at: string;
  notes: string | null;
  created_at: string;
  created_by: string;
}): InvoicePayment {
  return {
    id: row.id,
    documentId: row.document_id,
    amountCAD: Number(row.amount_cad),
    method: row.method as InvoicePaymentMethod,
    paidAt: String(row.paid_at).slice(0, 10),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

function roundCAD(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function getInvoiceGrandTotal(documentId: string): Promise<number | null> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("documents")
    .select("grand_total_cad, document_type")
    .eq("id", documentId)
    .maybeSingle();

  if (error || !data) return null;
  if (data.document_type !== "invoice") {
    return null;
  }
  return Number(data.grand_total_cad);
}

export async function assertInvoiceDocument(documentId: string): Promise<void> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("documents")
    .select("document_type")
    .eq("id", documentId)
    .maybeSingle();

  if (error || !data) {
    throw new AiError({
      code: "invalid_input",
      status: 404,
      clientMessage: "Document not found. Save the invoice first.",
    });
  }
  if (data.document_type !== "invoice") {
    throw new AiError({
      code: "invalid_input",
      status: 400,
      clientMessage: "Payments apply to invoices only. Convert the document to an invoice first.",
    });
  }
}

export async function listInvoicePayments(documentId: string): Promise<InvoicePayment[]> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("invoice_payments")
    .select("id, document_id, amount_cad, method, paid_at, notes, created_at, created_by")
    .eq("document_id", documentId)
    .order("paid_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new AiError({
      code: "internal",
      status: 500,
      clientMessage: "Could not load payments.",
      message: error.message,
    });
  }

  return (data ?? []).map(rowToPayment);
}

export async function buildPaymentSummary(
  documentId: string,
  grandTotalCAD?: number
): Promise<InvoicePaymentSummary> {
  await assertInvoiceDocument(documentId);
  const total =
    grandTotalCAD ?? (await getInvoiceGrandTotal(documentId)) ?? 0;
  const payments = await listInvoicePayments(documentId);
  const totalPaidCAD = roundCAD(payments.reduce((s, p) => s + p.amountCAD, 0));
  const balanceDueCAD = roundCAD(Math.max(0, total - totalPaidCAD));

  return {
    payments,
    totalPaidCAD,
    balanceDueCAD,
    grandTotalCAD: total,
  };
}

async function syncInvoicePaidStatus(documentId: string, grandTotalCAD: number): Promise<void> {
  const sb = requireSb();
  const payments = await listInvoicePayments(documentId);
  const totalPaidCAD = roundCAD(payments.reduce((s, p) => s + p.amountCAD, 0));
  const fullyPaid = totalPaidCAD >= grandTotalCAD - 0.005;

  const { data: doc } = await sb
    .from("documents")
    .select("status")
    .eq("id", documentId)
    .maybeSingle();

  if (!doc) return;

  const nextStatus = fullyPaid ? "paid" : doc.status === "paid" ? "sent" : doc.status;

  if (nextStatus !== doc.status) {
    await sb.from("documents").update({ status: nextStatus }).eq("id", documentId);
  }
}

export async function addInvoicePayment(
  documentId: string,
  input: InvoicePaymentInput,
  createdBy: string
): Promise<InvoicePaymentSummary> {
  await assertInvoiceDocument(documentId);

  const grandTotal = await getInvoiceGrandTotal(documentId);
  if (grandTotal == null) {
    throw new AiError({
      code: "invalid_input",
      status: 404,
      clientMessage: "Invoice not found. Save the invoice first.",
    });
  }

  const sb = requireSb();
  const paidAt = input.paidAt ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await sb
    .from("invoice_payments")
    .insert({
      document_id: documentId,
      amount_cad: roundCAD(input.amountCAD),
      method: input.method,
      paid_at: paidAt,
      notes: input.notes?.trim() || null,
      created_by: createdBy,
    })
    .select("id, document_id, amount_cad, method, paid_at, notes, created_at, created_by")
    .single();

  if (error) {
    throw new AiError({
      code: "internal",
      status: 500,
      clientMessage: "Could not record payment.",
      message: error.message,
    });
  }

  await syncInvoicePaidStatus(documentId, grandTotal);
  return buildPaymentSummary(documentId, grandTotal);
}

export async function deleteInvoicePayment(
  documentId: string,
  paymentId: string
): Promise<InvoicePaymentSummary> {
  const grandTotal = await getInvoiceGrandTotal(documentId);
  if (grandTotal == null) {
    throw new AiError({
      code: "invalid_input",
      status: 404,
      clientMessage: "Invoice not found.",
    });
  }

  const sb = requireSb();
  const { error } = await sb
    .from("invoice_payments")
    .delete()
    .eq("id", paymentId)
    .eq("document_id", documentId);

  if (error) {
    throw new AiError({
      code: "internal",
      status: 500,
      clientMessage: "Could not remove payment.",
      message: error.message,
    });
  }

  await syncInvoicePaidStatus(documentId, grandTotal);
  return buildPaymentSummary(documentId, grandTotal);
}
