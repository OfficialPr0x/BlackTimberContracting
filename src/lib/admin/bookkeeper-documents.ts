/**
 * Quotes / estimates / invoices context for the AI bookkeeper.
 * Keeps vault filing aligned with live admin documents (Supabase or JSONL).
 */

import "server-only";

import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import { listQuotes, loadQuote } from "./quotes";
import type { AdminDocumentType, AdminQuoteSaved } from "./schemas";

const DOC_ID_RE = /\b([QEI]-\d{8}-[A-Z0-9]{4})\b/g;

export interface BookkeeperDocumentRow {
  id: string;
  documentType: AdminDocumentType;
  status: AdminQuoteSaved["status"];
  customerName: string;
  scopeSummary: string;
  validUntil: string;
  grandTotalCAD: number;
  gstCAD: number;
  pstCAD: number;
  updatedAt: string;
}

export async function fetchDocumentsForBookkeeper(
  limit = 80
): Promise<BookkeeperDocumentRow[]> {
  const sb = getSupabaseAdmin();
  if (sb && isSupabaseConfigured()) {
    const { data, error } = await sb
      .from("documents")
      .select(
        "id, document_type, status, customer_name, project_scope_summary, valid_until, grand_total_cad, gst_cad, pst_cad, updated_at"
      )
      .order("updated_at", { ascending: false })
      .limit(Math.min(limit, 120));

    if (!error && data?.length) {
      return data.map((d) => ({
        id: d.id as string,
        documentType: d.document_type as AdminDocumentType,
        status: d.status as AdminQuoteSaved["status"],
        customerName: d.customer_name as string,
        scopeSummary: (d.project_scope_summary as string) || "—",
        validUntil: String(d.valid_until).slice(0, 10),
        grandTotalCAD: Number(d.grand_total_cad),
        gstCAD: Number(d.gst_cad),
        pstCAD: Number(d.pst_cad),
        updatedAt: String(d.updated_at),
      }));
    }
    if (error) console.error("[bookkeeper documents]", error.message);
  }

  const quotes = await listQuotes(limit);
  return quotes.map((q) => ({
    id: q.id,
    documentType: q.documentType,
    status: q.status,
    customerName: q.customer.name,
    scopeSummary: q.project.scopeSummary,
    validUntil: q.validUntil,
    grandTotalCAD: q.totals.grandTotalCAD,
    gstCAD: q.totals.gstCAD,
    pstCAD: q.totals.pstCAD,
    updatedAt: q.updatedAt,
  }));
}

export function extractDocumentIdsFromText(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(DOC_ID_RE)) {
    seen.add(m[1]);
  }
  return [...seen].slice(0, 4);
}

export function extractDocumentIdsFromMessages(
  messages: Array<{ content: string }>
): string[] {
  const seen = new Set<string>();
  for (const m of messages.slice(-6)) {
    for (const id of extractDocumentIdsFromText(m.content)) seen.add(id);
  }
  return [...seen].slice(0, 4);
}

export function formatDocumentsRegisterForPrompt(rows: BookkeeperDocumentRow[]): string {
  if (rows.length === 0) {
    return "(No quotes/invoices in database yet — use /admin/quotes to create Q-/E-/I- documents.)";
  }

  const lines = rows.map((r) => {
    const type =
      r.documentType === "invoice" ? "INV" : r.documentType === "estimate" ? "EST" : "QTE";
    const due =
      r.documentType === "invoice" ? ` due ${r.validUntil}` : ` valid ${r.validUntil}`;
    const tax =
      r.gstCAD > 0 || r.pstCAD > 0
        ? ` GST $${r.gstCAD.toFixed(2)} PST $${r.pstCAD.toFixed(2)}`
        : "";
    return `- ${r.id} [${type}] ${r.status} · ${r.customerName} · $${r.grandTotalCAD.toFixed(2)}${tax}${due} · ${r.scopeSummary.slice(0, 72)}`;
  });

  const counts = summarizeByStatus(rows);
  return [
    `Register (${rows.length} documents, newest first):`,
    ...lines,
    "",
    `Counts: ${counts}`,
    "Preview PDF: /admin/preview?id=<ID> · Edit: /admin/quotes",
  ].join("\n");
}

function summarizeByStatus(rows: BookkeeperDocumentRow[]): string {
  const c: Record<string, number> = {};
  for (const r of rows) {
    const key = `${r.documentType}/${r.status}`;
    c[key] = (c[key] ?? 0) + 1;
  }
  return Object.entries(c)
    .map(([k, n]) => `${k}=${n}`)
    .join(", ");
}

export function analyzePaperworkGaps(rows: BookkeeperDocumentRow[]): string[] {
  const today = new Date().toISOString().slice(0, 10);
  const alerts: string[] = [];

  for (const r of rows) {
    if (r.documentType === "invoice" && r.status !== "paid" && r.validUntil < today) {
      alerts.push(
        `OVERDUE INVOICE ${r.id} (${r.customerName}) — $${r.grandTotalCAD.toFixed(2)}, due ${r.validUntil}, status ${r.status}`
      );
    }
    if (
      (r.documentType === "quote" || r.documentType === "estimate") &&
      r.status === "sent" &&
      r.validUntil < today
    ) {
      alerts.push(
        `EXPIRED ${r.documentType.toUpperCase()} ${r.id} (${r.customerName}) — valid-until ${r.validUntil} passed`
      );
    }
    if (r.status === "accepted" && r.documentType !== "invoice") {
      alerts.push(
        `ACCEPTED ${r.documentType.toUpperCase()} ${r.id} (${r.customerName}) — consider invoice + vault archive`
      );
    }
  }

  const unpaidInvoices = rows.filter(
    (r) => r.documentType === "invoice" && r.status !== "paid"
  );
  if (unpaidInvoices.length > 0) {
    const total = unpaidInvoices.reduce((s, r) => s + r.grandTotalCAD, 0);
    alerts.push(
      `OPEN AR: ${unpaidInvoices.length} invoice(s), $${total.toFixed(2)} outstanding (match bank deposits)`
    );
  }

  return alerts.slice(0, 12);
}

export function formatDocumentDetailForPrompt(doc: AdminQuoteSaved): string {
  const lineRows = doc.lines
    .map(
      (l) =>
        `  · ${l.quantity} ${l.uom} × $${l.unitPriceCAD.toFixed(2)} — ${l.description} (${l.source})`
    )
    .join("\n");

  return [
    `--- ${doc.id} (${doc.documentType}, ${doc.status}) ---`,
    `Customer: ${doc.customer.name}`,
    doc.customer.email ? `Email: ${doc.customer.email}` : "",
    doc.customer.phone ? `Phone: ${doc.customer.phone}` : "",
    `Project: ${doc.project.type} — ${doc.project.scopeSummary}`,
    `Tax: ${doc.taxMode} · Valid/due: ${doc.validUntil}`,
    `Totals: subtotal $${doc.totals.subtotalCAD.toFixed(2)} · GST $${doc.totals.gstCAD.toFixed(2)} · PST $${doc.totals.pstCAD.toFixed(2)} · **Grand $${doc.totals.grandTotalCAD.toFixed(2)}**`,
    doc.paymentTerms ? `Payment terms: ${doc.paymentTerms}` : "",
    doc.internalNotes ? `Internal notes: ${doc.internalNotes}` : "",
    `Lines (${doc.lines.length}):`,
    lineRows || "  (no lines)",
    `---`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Markdown snapshot for vault folder "Quotes & Invoices". */
export function documentToVaultMarkdown(doc: AdminQuoteSaved): string {
  const t = doc.totals;
  const lines = doc.lines
    .map(
      (l, i) =>
        `| ${i + 1} | ${l.description.replace(/\|/g, "/")} | ${l.quantity} ${l.uom} | $${l.unitPriceCAD.toFixed(2)} | ${l.source} |`
    )
    .join("\n");

  return [
    `# ${doc.id} — ${doc.customer.name}`,
    "",
    `| Field | Value |`,
    `| --- | --- |`,
    `| Type | ${doc.documentType} |`,
    `| Status | ${doc.status} |`,
    `| Updated | ${doc.updatedAt.slice(0, 10)} |`,
    `| Valid / due | ${doc.validUntil} |`,
    `| Tax mode | ${doc.taxMode} |`,
    `| Subtotal | $${t.subtotalCAD.toFixed(2)} |`,
    `| GST | $${t.gstCAD.toFixed(2)} |`,
    `| PST | $${t.pstCAD.toFixed(2)} |`,
    `| **Grand total** | **$${t.grandTotalCAD.toFixed(2)}** |`,
    "",
    `## Project`,
    doc.project.scopeSummary,
    doc.project.notes ? `\n${doc.project.notes}` : "",
    "",
    doc.paymentTerms ? `## Payment terms\n${doc.paymentTerms}\n` : "",
    doc.paymentInstructions ? `## Payment instructions\n${doc.paymentInstructions}\n` : "",
    doc.internalNotes ? `## Internal notes\n${doc.internalNotes}\n` : "",
    "",
    "## Line items",
    "",
    "| # | Description | Qty | Unit | Source |",
    "| --- | --- | --- | --- | --- |",
    lines,
    "",
    `---`,
    `*Archived from admin quotes · ${new Date().toISOString().slice(0, 10)}*`,
    `*PDF: /admin/preview?id=${doc.id}*`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function loadDocumentsForBookkeeper(ids: string[]): Promise<AdminQuoteSaved[]> {
  const out: AdminQuoteSaved[] = [];
  for (const id of ids) {
    const doc = await loadQuote(id);
    if (doc) out.push(doc);
  }
  return out;
}

export function vaultArchiveFileName(doc: AdminQuoteSaved): string {
  const slug = doc.customer.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${doc.id}-${slug || "customer"}.md`;
}
