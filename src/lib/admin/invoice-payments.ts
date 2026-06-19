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

// -----------------------------------------------------------------------------
// Portfolio-wide finance rollup (dashboard)
// -----------------------------------------------------------------------------

export interface InvoiceFinanceRow {
  id: string;
  customerName: string;
  grandTotalCAD: number;
  paidCAD: number;
  balanceCAD: number;
  status: string;
  dueDate: string | null;
  overdue: boolean;
  lastPaymentAt: string | null;
}

export interface InvoiceDepositRow {
  paymentId: string;
  documentId: string;
  customerName: string;
  amountCAD: number;
  method: InvoicePaymentMethod;
  paidAt: string;
}

export interface InvoiceFinanceSummary {
  invoiceCount: number;
  /** Sum of every invoice grand total. */
  totalInvoicedCAD: number;
  /** Sum of every recorded payment ("deposits made"). */
  totalCollectedCAD: number;
  /** Sum of positive per-invoice balances ("outstanding owing"). */
  outstandingCAD: number;
  /** Collected portion that counts against invoiced (clamped, never > invoiced). */
  appliedCollectedCAD: number;
  paidCount: number;
  partialCount: number;
  unpaidCount: number;
  overdueCount: number;
  overdueAmountCAD: number;
  /** appliedCollected / invoiced, 0..1. */
  collectionRate: number;
  /** Open invoices (balance > 0), largest balance first. */
  outstanding: InvoiceFinanceRow[];
  /** Most recent payments, newest first. */
  recentDeposits: InvoiceDepositRow[];
}

/**
 * Aggregate every invoice and its payments into the figures the dashboard
 * shows: total invoiced, deposits collected, and outstanding owing. Cheap full
 * scan — fine for a one-person business; add server-side aggregation if it ever
 * grows into tens of thousands of rows.
 */
export async function getInvoiceFinanceSummary(opts?: {
  outstandingLimit?: number;
  depositsLimit?: number;
}): Promise<InvoiceFinanceSummary> {
  const sb = requireSb();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: invoices, error: invErr }, { data: pays, error: payErr }] = await Promise.all([
    sb
      .from("documents")
      .select("id, customer_name, grand_total_cad, status, valid_until")
      .eq("document_type", "invoice"),
    sb
      .from("invoice_payments")
      .select("id, document_id, amount_cad, method, paid_at, created_at"),
  ]);

  if (invErr) {
    throw new AiError({
      code: "internal",
      status: 500,
      clientMessage: "Could not load invoices.",
      message: invErr.message,
    });
  }
  if (payErr) {
    throw new AiError({
      code: "internal",
      status: 500,
      clientMessage: "Could not load payments.",
      message: payErr.message,
    });
  }

  const paidByDoc = new Map<string, number>();
  const lastPayByDoc = new Map<string, string>();
  for (const p of pays ?? []) {
    const amt = Number(p.amount_cad);
    paidByDoc.set(p.document_id, roundCAD((paidByDoc.get(p.document_id) ?? 0) + amt));
    const at = String(p.paid_at).slice(0, 10);
    const prev = lastPayByDoc.get(p.document_id);
    if (!prev || at > prev) lastPayByDoc.set(p.document_id, at);
  }

  const customerByDoc = new Map<string, string>();

  let totalInvoicedCAD = 0;
  let totalCollectedCAD = 0;
  let appliedCollectedCAD = 0;
  let outstandingCAD = 0;
  let paidCount = 0;
  let partialCount = 0;
  let unpaidCount = 0;
  let overdueCount = 0;
  let overdueAmountCAD = 0;

  const rows: InvoiceFinanceRow[] = [];

  for (const inv of invoices ?? []) {
    const total = Number(inv.grand_total_cad);
    const paid = paidByDoc.get(inv.id) ?? 0;
    const balance = roundCAD(Math.max(0, total - paid));
    const customerName = String(inv.customer_name ?? "—");
    customerByDoc.set(inv.id, customerName);

    totalInvoicedCAD = roundCAD(totalInvoicedCAD + total);
    appliedCollectedCAD = roundCAD(appliedCollectedCAD + Math.min(paid, total));
    outstandingCAD = roundCAD(outstandingCAD + balance);

    if (paid <= 0.005) unpaidCount += 1;
    else if (balance <= 0.005) paidCount += 1;
    else partialCount += 1;

    const dueDate = inv.valid_until ? String(inv.valid_until).slice(0, 10) : null;
    const overdue = balance > 0.005 && !!dueDate && dueDate < today;
    if (overdue) {
      overdueCount += 1;
      overdueAmountCAD = roundCAD(overdueAmountCAD + balance);
    }

    rows.push({
      id: inv.id,
      customerName,
      grandTotalCAD: total,
      paidCAD: roundCAD(paid),
      balanceCAD: balance,
      status: String(inv.status ?? "draft"),
      dueDate,
      overdue,
      lastPaymentAt: lastPayByDoc.get(inv.id) ?? null,
    });
  }

  totalCollectedCAD = roundCAD((pays ?? []).reduce((s, p) => s + Number(p.amount_cad), 0));

  const collectionRate =
    totalInvoicedCAD > 0 ? Math.min(1, appliedCollectedCAD / totalInvoicedCAD) : 0;

  const outstanding = rows
    .filter((r) => r.balanceCAD > 0.005)
    .sort((a, b) => {
      // Overdue first, then largest balance.
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return b.balanceCAD - a.balanceCAD;
    })
    .slice(0, opts?.outstandingLimit ?? 6);

  const recentDeposits: InvoiceDepositRow[] = (pays ?? [])
    .slice()
    .sort((a, b) => {
      const ad = String(a.paid_at);
      const bd = String(b.paid_at);
      if (ad !== bd) return bd.localeCompare(ad);
      return String(b.created_at).localeCompare(String(a.created_at));
    })
    .slice(0, opts?.depositsLimit ?? 6)
    .map((p) => ({
      paymentId: String(p.id),
      documentId: String(p.document_id),
      customerName: customerByDoc.get(String(p.document_id)) ?? "—",
      amountCAD: Number(p.amount_cad),
      method: p.method as InvoicePaymentMethod,
      paidAt: String(p.paid_at).slice(0, 10),
    }));

  return {
    invoiceCount: (invoices ?? []).length,
    totalInvoicedCAD,
    totalCollectedCAD,
    outstandingCAD,
    appliedCollectedCAD,
    paidCount,
    partialCount,
    unpaidCount,
    overdueCount,
    overdueAmountCAD,
    collectionRate,
    outstanding,
    recentDeposits,
  };
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
