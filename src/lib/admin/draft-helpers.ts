/**
 * Draft helpers for the /admin quote builder — easier save + PDF preview.
 */

import { computeQuoteTotals } from "./quote-totals";
import type {
  AdminDocumentType,
  AdminQuoteCustomer,
  AdminQuoteLine,
  AdminQuoteProject,
  AdminQuoteSaved,
  AdminQuoteTaxMode,
} from "./schemas";

export const PREVIEW_STORAGE_KEY = "btc_admin_preview_v1";

const PROJECT_LABELS: Record<string, string> = {
  deck: "Deck",
  pergola: "Pergola",
  garage: "Garage",
  addition: "Addition",
  fence: "Fence",
  renovation: "Renovation",
  flooring: "Flooring",
  roofing: "Roofing",
  siding: "Siding",
  interior_finish: "Interior finish",
  structural_repair: "Structural repair",
  other: "Other",
};

export interface LineDraft {
  id: string;
  description: string;
  quantity: number;
  uom: AdminQuoteLine["uom"];
  unitPriceCAD: number;
  source: AdminQuoteLine["source"];
  leadTimeDays?: number;
  notes?: string;
}

export function filterValidLines(lines: LineDraft[]): AdminQuoteLine[] {
  return lines.filter((l) => l.description.trim().length > 0);
}

/** Postgres / get_document JSON uses null; Zod `.optional()` rejects null. */
export function finiteOptional(n: unknown): number | undefined {
  if (n == null || n === "") return undefined;
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : undefined;
}

export function optionalString(s: unknown): string | undefined {
  if (s == null) return undefined;
  const t = String(s).trim();
  return t || undefined;
}

/** Deep-convert null → undefined so AdminQuoteInput validation passes on edits. */
export function stripNullsDeep(value: unknown): unknown {
  if (value === null) return undefined;
  if (Array.isArray(value)) return value.map(stripNullsDeep);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, stripNullsDeep(v)])
    );
  }
  return value;
}

function normalizeLineDraft(l: LineDraft): AdminQuoteLine {
  const lead = finiteOptional(l.leadTimeDays);
  return {
    id: l.id,
    description: l.description.trim(),
    quantity: finiteOptional(l.quantity) ?? 1,
    uom: l.uom,
    unitPriceCAD: finiteOptional(l.unitPriceCAD) ?? 0,
    source: l.source,
    ...(lead !== undefined ? { leadTimeDays: Math.round(lead) } : {}),
    ...(optionalString(l.notes) ? { notes: optionalString(l.notes) } : {}),
  };
}

/** Build scope text from line items when the user skipped the textarea. */
export function deriveScopeSummary(
  project: AdminQuoteProject,
  lines: LineDraft[],
  documentType: AdminDocumentType
): string {
  const manual = project.scopeSummary.trim();
  if (manual.length >= 8) return manual;

  const typeLabel = PROJECT_LABELS[project.type] ?? project.type;
  const mat = project.material?.trim() ? ` · ${project.material.trim()}` : "";
  const dims =
    project.lengthFt && project.widthFt
      ? ` · ${project.lengthFt}×${project.widthFt} ft`
      : "";
  const doc =
    documentType === "invoice"
      ? "Invoice"
      : documentType === "estimate"
      ? "Estimate"
      : "Quote";

  const itemSummaries = filterValidLines(lines)
    .slice(0, 6)
    .map((l) => {
      const q = Number.isFinite(l.quantity) ? l.quantity : 0;
      return `${l.description.trim()} (${q} ${l.uom})`;
    });

  if (itemSummaries.length === 0) {
    return `${doc} for ${typeLabel} work${mat}${dims}.`;
  }

  const more = filterValidLines(lines).length > 6 ? " (see line items for full detail.)" : "";
  return `${doc} — ${typeLabel}${mat}${dims}: ${itemSummaries.join("; ")}${more}`;
}

export function validateDraftForSave(
  customer: AdminQuoteCustomer,
  lines: LineDraft[]
): { ok: true } | { ok: false; message: string } {
  if (!customer.name.trim()) {
    return { ok: false, message: "Customer name is required." };
  }
  const valid = filterValidLines(lines);
  if (valid.length === 0) {
    return { ok: false, message: "Add at least one line item with a description." };
  }
  return { ok: true };
}

export interface DraftPayload {
  documentType: AdminDocumentType;
  customer: AdminQuoteCustomer;
  project: AdminQuoteProject;
  lines: LineDraft[];
  taxMode: AdminQuoteTaxMode;
  freightCAD: number;
  validUntil: string;
  status: AdminQuoteSaved["status"];
  internalNotes?: string;
  paymentTerms?: string;
  paymentInstructions?: string;
  savedQuoteId?: string | null;
}

/** Build AdminQuoteSaved for preview / print without persisting. */
export function buildPreviewDocument(input: DraftPayload): AdminQuoteSaved {
  const scopeSummary = deriveScopeSummary(input.project, input.lines, input.documentType);
  const lines = filterValidLines(input.lines);
  const totals = computeQuoteTotals(lines, input.taxMode, input.freightCAD);
  const now = new Date().toISOString();

  return {
    id: input.savedQuoteId ?? "Q-PREVIEW-00000000-DRFT",
    documentType: input.documentType,
    status: input.status,
    customer: input.customer,
    project: { ...input.project, scopeSummary },
    lines,
    taxMode: input.taxMode,
    freightCAD: input.freightCAD,
    validUntil: input.validUntil,
    internalNotes: input.internalNotes,
    paymentTerms: input.paymentTerms,
    paymentInstructions: input.paymentInstructions,
    totals,
    createdAt: now,
    updatedAt: now,
    createdBy: "preview",
  };
}

/** Hydrate builder form state from a saved document. */
export function draftFromSavedQuote(quote: AdminQuoteSaved): {
  customer: AdminQuoteCustomer;
  project: AdminQuoteProject;
  lines: LineDraft[];
  taxMode: AdminQuoteTaxMode;
  freightCAD: number;
  documentType: AdminDocumentType;
  validUntil: string;
  internalNotes: string;
  paymentTerms: string;
  paymentInstructions: string;
  status: AdminQuoteSaved["status"];
} {
  return {
    customer: {
      name: quote.customer.name,
      email: quote.customer.email ?? "",
      phone: quote.customer.phone ?? "",
      billingAddress: quote.customer.billingAddress ?? "",
      jobSiteAddress: quote.customer.jobSiteAddress ?? "",
    },
    project: {
      type: quote.project.type,
      scopeSummary: quote.project.scopeSummary,
      lengthFt: finiteOptional(quote.project.lengthFt),
      widthFt: finiteOptional(quote.project.widthFt),
      material: optionalString(quote.project.material),
      notes: optionalString(quote.project.notes),
    },
    lines:
      quote.lines.length > 0
        ? quote.lines.map((l) => ({
            id: l.id,
            description: l.description,
            quantity: finiteOptional(l.quantity) ?? 1,
            uom: l.uom,
            unitPriceCAD: finiteOptional(l.unitPriceCAD) ?? 0,
            source: l.source,
            leadTimeDays: finiteOptional(l.leadTimeDays),
            notes: optionalString(l.notes),
          }))
        : [{ id: `line-${Date.now()}`, description: "", quantity: 1, uom: "EA" as const, unitPriceCAD: 0, source: "other" as const }],
    taxMode: quote.taxMode,
    freightCAD: quote.freightCAD,
    documentType: quote.documentType,
    validUntil: quote.validUntil,
    internalNotes: quote.internalNotes ?? "",
    paymentTerms: quote.paymentTerms ?? "Net 14",
    paymentInstructions: quote.paymentInstructions ?? "",
    status: quote.status,
  };
}

export function buildSavePayload(input: DraftPayload): Record<string, unknown> {
  const scopeSummary = deriveScopeSummary(input.project, input.lines, input.documentType);
  const lines = filterValidLines(input.lines).map(normalizeLineDraft);

  const project: AdminQuoteProject = {
    type: input.project.type,
    scopeSummary,
    material: optionalString(input.project.material),
    notes: optionalString(input.project.notes),
  };
  const lengthFt = finiteOptional(input.project.lengthFt);
  const widthFt = finiteOptional(input.project.widthFt);
  if (lengthFt !== undefined) project.lengthFt = lengthFt;
  if (widthFt !== undefined) project.widthFt = widthFt;

  return {
    id: input.savedQuoteId ?? undefined,
    documentType: input.documentType,
    customer: {
      name: input.customer.name.trim(),
      email: optionalString(input.customer.email),
      phone: optionalString(input.customer.phone),
      billingAddress: optionalString(input.customer.billingAddress),
      jobSiteAddress: optionalString(input.customer.jobSiteAddress),
    },
    project,
    lines,
    taxMode: input.taxMode,
    freightCAD: input.freightCAD,
    validUntil: input.validUntil,
    status: input.status,
    internalNotes: input.internalNotes?.trim() || undefined,
    paymentTerms:
      input.documentType === "invoice" && input.paymentTerms?.trim()
        ? input.paymentTerms.trim()
        : undefined,
    paymentInstructions:
      input.documentType === "invoice" && input.paymentInstructions?.trim()
        ? input.paymentInstructions.trim()
        : undefined,
  };
}
