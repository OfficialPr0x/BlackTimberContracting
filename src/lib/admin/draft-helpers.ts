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

/** Payload for POST /api/admin/quotes from current form state. */
export function buildSavePayload(input: DraftPayload): Record<string, unknown> {
  const scopeSummary = deriveScopeSummary(input.project, input.lines, input.documentType);
  const lines = filterValidLines(input.lines);

  return {
    id: input.savedQuoteId ?? undefined,
    documentType: input.documentType,
    customer: {
      ...input.customer,
      email: input.customer.email?.trim() || undefined,
      phone: input.customer.phone?.trim() || undefined,
      billingAddress: input.customer.billingAddress?.trim() || undefined,
      jobSiteAddress: input.customer.jobSiteAddress?.trim() || undefined,
    },
    project: {
      ...input.project,
      scopeSummary,
      material: input.project.material?.trim() || undefined,
      notes: input.project.notes?.trim() || undefined,
    },
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
