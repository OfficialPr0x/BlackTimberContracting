import "server-only";

import { z } from "zod";
import {
  AdminDocumentType,
  AdminQuoteInput,
  AdminQuoteProjectType,
  AdminQuoteTaxMode,
  QuoteLineSource,
  QuoteLineUom,
} from "./schemas";
import { computeQuoteTotals } from "./quote-totals";
import { saveQuote } from "./quotes";
import type { AdminQuoteSaved, AdminQuoteTotals } from "./schemas";
import { createEsignFromQuote } from "@/lib/esign/create-from-source";

/**
 * The onsite estimator's working draft. Intentionally LENIENT (looser mins,
 * email not strictly validated) so the model can return a partial draft mid-
 * conversation without failing schema validation. Strict validation only
 * happens at create-document time via AdminQuoteInput.
 */
const DraftLine = z.object({
  description: z.string().min(1).max(280),
  quantity: z.number().min(0).max(100_000),
  uom: QuoteLineUom.default("EA"),
  unitPriceCAD: z.number().min(0).max(1_000_000),
  source: QuoteLineSource.default("other"),
  leadTimeDays: z.number().int().min(0).max(365).optional(),
  notes: z.string().max(280).optional(),
});
export type DraftLine = z.infer<typeof DraftLine>;

export const EstimatorDraft = z.object({
  /** Set to an existing Q-/E-/I- id to UPDATE that document on create. */
  id: z.string().max(40).optional(),
  documentType: AdminDocumentType.default("estimate"),
  customer: z
    .object({
      name: z.string().max(120).default(""),
      email: z.string().max(200).optional(),
      phone: z.string().max(40).optional(),
      billingAddress: z.string().max(300).optional(),
      jobSiteAddress: z.string().max(300).optional(),
    })
    .default({ name: "" }),
  project: z
    .object({
      type: AdminQuoteProjectType.default("other"),
      scopeSummary: z.string().max(2000).default(""),
      lengthFt: z.number().min(0).max(500).optional(),
      widthFt: z.number().min(0).max(500).optional(),
      material: z.string().max(120).optional(),
      notes: z.string().max(2000).optional(),
    })
    .default({ type: "other", scopeSummary: "" }),
  lines: z.array(DraftLine).max(80).default([]),
  taxMode: AdminQuoteTaxMode.default("real_property_install"),
  freightCAD: z.number().min(0).max(100_000).default(0),
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  paymentTerms: z.string().max(120).optional(),
  paymentInstructions: z.string().max(800).optional(),
  internalNotes: z.string().max(4000).optional(),
});
export type EstimatorDraft = z.infer<typeof EstimatorDraft>;

export const EstimatorAction = z.discriminatedUnion("type", [
  /** Persist the CURRENT draft as a real Q-/E-/I- document (or update if draft.id set). */
  z.object({ type: z.literal("create_document") }),
  /** Send an existing document for client e-signature. */
  z.object({
    type: z.literal("create_esign"),
    documentId: z.string().regex(/^[QEI]-\d{8}-[A-Z0-9]{4}$/),
    sendNow: z.boolean().optional(),
    signerEmail: z.string().email().max(200).optional(),
    signerName: z.string().max(120).optional(),
    signerMessage: z.string().max(2000).optional(),
  }),
]);
export type EstimatorAction = z.infer<typeof EstimatorAction>;

export const EstimatorResponseSchema = z.object({
  reply: z.string().min(1).max(16_000),
  /** The estimator's current working document. Null when no job is in progress. */
  draft: EstimatorDraft.nullable().optional(),
  actions: z.array(EstimatorAction).max(4).default([]),
});
export type EstimatorResponse = z.infer<typeof EstimatorResponseSchema>;

export interface ExecutedEstimatorAction {
  type: "create_document" | "create_esign";
  documentType?: AdminDocumentType;
  id: string;
  name: string;
  grandTotalCAD?: number;
  previewUrl?: string;
  signUrl?: string;
}

/** Server-side totals for a draft so the chat preview shows real numbers. */
export function previewDraftTotals(draft: EstimatorDraft): AdminQuoteTotals {
  return computeQuoteTotals(
    draft.lines.map((l, i) => ({ ...l, id: `draft-${i}` })),
    draft.taxMode,
    draft.freightCAD
  );
}

/**
 * Convert the lenient draft into the strict AdminQuoteInput the storage layer
 * requires. Returns either a valid input or a human-readable list of what's
 * still missing (so the agent/UI can ask for it instead of 500ing).
 */
function draftToQuoteInput(
  draft: EstimatorDraft
): { ok: true; input: z.infer<typeof AdminQuoteInput> } | { ok: false; missing: string[] } {
  const candidate = {
    id: draft.id && /^[QEI]-\d{8}-[A-Z0-9]{4}$/.test(draft.id) ? draft.id : undefined,
    documentType: draft.documentType,
    customer: {
      name: draft.customer.name?.trim() ?? "",
      email: draft.customer.email?.trim() || undefined,
      phone: draft.customer.phone?.trim() || undefined,
      billingAddress: draft.customer.billingAddress?.trim() || undefined,
      jobSiteAddress: draft.customer.jobSiteAddress?.trim() || undefined,
    },
    project: {
      type: draft.project.type,
      scopeSummary: draft.project.scopeSummary?.trim() || "",
      lengthFt: draft.project.lengthFt,
      widthFt: draft.project.widthFt,
      material: draft.project.material?.trim() || undefined,
      notes: draft.project.notes?.trim() || undefined,
    },
    lines: draft.lines.map((l, i) => ({ ...l, id: `L${i + 1}` })),
    taxMode: draft.taxMode,
    freightCAD: draft.freightCAD,
    validUntil: draft.validUntil,
    status: "draft" as const,
    internalNotes: draft.internalNotes,
    paymentTerms: draft.paymentTerms,
    paymentInstructions: draft.paymentInstructions,
  };

  const parsed = AdminQuoteInput.safeParse(candidate);
  if (parsed.success) return { ok: true, input: parsed.data };

  const missing: string[] = [];
  if (!candidate.customer.name || candidate.customer.name.length < 2)
    missing.push("customer name");
  if (candidate.lines.length === 0) missing.push("at least one line item");
  if (!candidate.project.scopeSummary) missing.push("a short scope summary");
  if (candidate.customer.email && !/^\S+@\S+\.\S+$/.test(candidate.customer.email))
    missing.push("a valid customer email (or remove it)");
  if (missing.length === 0) {
    // Fallback: surface the first Zod issue so we never claim "nothing missing".
    missing.push(parsed.error.issues[0]?.message ?? "valid document fields");
  }
  return { ok: false, missing };
}

/**
 * Execute the estimator's actions: save the current draft as a real document
 * and/or fire off an e-signature. Errors are isolated and returned as strings.
 */
export async function executeEstimatorActions(
  actions: EstimatorAction[],
  draft: EstimatorDraft | null | undefined,
  createdBy: string
): Promise<{ executed: ExecutedEstimatorAction[]; errors: string[] }> {
  const executed: ExecutedEstimatorAction[] = [];
  const errors: string[] = [];
  let lastSaved: AdminQuoteSaved | null = null;

  for (const action of actions) {
    try {
      if (action.type === "create_document") {
        if (!draft) {
          errors.push("No draft to save yet — describe the job first.");
          continue;
        }
        const conv = draftToQuoteInput(draft);
        if (!conv.ok) {
          errors.push(`Can't save yet — still need: ${conv.missing.join(", ")}.`);
          continue;
        }
        const saved = await saveQuote(conv.input, createdBy);
        lastSaved = saved;
        executed.push({
          type: "create_document",
          documentType: saved.documentType,
          id: saved.id,
          name: saved.customer.name,
          grandTotalCAD: saved.totals.grandTotalCAD,
          previewUrl: `/admin/preview?id=${saved.id}`,
        });
      } else {
        // Default to the just-saved doc if the model omitted an explicit id.
        const documentId = action.documentId || lastSaved?.id;
        if (!documentId) {
          errors.push("E-sign needs a document id — create or name the document first.");
          continue;
        }
        const { envelope, emailErrors } = await createEsignFromQuote({
          documentId,
          sendNow: action.sendNow ?? true,
          signerEmail: action.signerEmail,
          signerName: action.signerName,
          signerMessage: action.signerMessage,
        });
        executed.push({
          type: "create_esign",
          id: envelope.id,
          name: envelope.title,
          signUrl: envelope.signUrl,
        });
        for (const e of emailErrors) errors.push(`E-sign email: ${e}`);
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Action failed");
    }
  }

  return { executed, errors };
}

export const ESTIMATOR_JSON_HINT = `
Return ONE JSON object only:
{
  "reply": "markdown answer for Jaryd — lead with the bottom-line number when you have one",
  "draft": {
    "documentType": "estimate",
    "customer": { "name": "", "email": "", "phone": "", "jobSiteAddress": "" },
    "project": { "type": "deck", "scopeSummary": "...", "lengthFt": 0, "widthFt": 0, "material": "" },
    "lines": [
      { "description": "Supply & install ...", "quantity": 240, "uom": "SQFT", "unitPriceCAD": 12.5, "source": "labor", "notes": "incl. 8% waste" }
    ],
    "taxMode": "real_property_install",
    "freightCAD": 0
  },
  "actions": []
}
Rules:
- Keep ONE draft going for the current job. Return the FULL updated draft every
  time you change it (don't send line deltas). Set "draft": null only if there's
  truly no job in progress (pure ops question).
- uom: SQFT flooring/roofing/siding area, LF trim/decking/railing, EA lump items,
  HR/DAY crew time, BX/BG/LOT as needed.
- source: fernie_hh_stocked | fernie_hh_special_order | other_supplier | labor |
  subcontractor | other.
- taxMode: real_property_install (installed work, GST only) | supply_only (GST+PST) |
  mixed_split | exempt.
- ONLY put { "type": "create_document" } in actions when Jaryd commands it
  ("create it", "save the estimate"). It saves the CURRENT draft (set draft.id to
  an existing Q-/E-/I- id to update instead of create).
- { "type": "create_esign", "documentId": "Q-...", "sendNow": true } only when
  asked to send for signature (needs a customer email on the doc).
- actions is [] otherwise.
`.trim();
