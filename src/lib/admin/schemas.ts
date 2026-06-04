/**
 * Zod schemas for the /admin quote builder.
 *
 * Kept separate from `src/lib/openrouter/schemas.ts` because:
 *   - The admin builder is a workflow, not an AI call. It just happens to USE
 *     an AI suggestion endpoint as one input among many.
 *   - The customer-facing wizard outputs a "ballpark estimate" shape; the
 *     admin builder outputs an actual line-item quote with CAD pricing,
 *     BC GST/PST, and supplier sourcing per line. Different shape entirely.
 *
 * Currency is CAD throughout — these are real Black Timber-issued quotes,
 * not the marketing-side wizard estimates (which the brand prompt configures
 * as USD by default).
 */

import { z } from "zod";

// =============================================================================
// Line items
// =============================================================================

/**
 * Where this line ultimately comes from. Drives lead-time messaging and the
 * "stocked vs special order" honesty rule from the supplier primer.
 */
export const QuoteLineSource = z.enum([
  "fernie_hh_stocked",
  "fernie_hh_special_order",
  "other_supplier",
  "labor",
  "subcontractor",
  "other",
]);
export type QuoteLineSource = z.infer<typeof QuoteLineSource>;

/**
 * Unit of measure. Kept short so the on-screen table stays readable.
 *   EA = each, LF = linear ft, SQFT = square ft, BX = box, BG = bag,
 *   HR = hour, DAY = day, LOT = lump-sum bundle.
 */
export const QuoteLineUom = z.enum(["EA", "LF", "SQFT", "BX", "BG", "HR", "DAY", "LOT"]);
export type QuoteLineUom = z.infer<typeof QuoteLineUom>;

export const AdminQuoteLine = z.object({
  // Local React-key; never trust client-supplied ids on save.
  id: z.string().min(1).max(64),
  description: z.string().min(1).max(280),
  quantity: z.number().min(0).max(100_000),
  uom: QuoteLineUom.default("EA"),
  unitPriceCAD: z.number().min(0).max(1_000_000),
  source: QuoteLineSource.default("other"),
  // Optional vendor lead time for special-order lines, used in totals view.
  leadTimeDays: z.number().int().min(0).max(365).optional(),
  notes: z.string().max(280).optional(),
});
export type AdminQuoteLine = z.infer<typeof AdminQuoteLine>;

// =============================================================================
// Customer + project header
// =============================================================================

export const AdminQuoteCustomer = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(200).or(z.literal("")).optional(),
  phone: z.string().max(40).optional(),
  billingAddress: z.string().max(300).optional(),
  jobSiteAddress: z.string().max(300).optional(),
});
export type AdminQuoteCustomer = z.infer<typeof AdminQuoteCustomer>;

/**
 * Project category. Drives copy in the print view and helps the AI parse
 * scope text + suggest line items. Keep this list in sync with the type
 * dropdown in `quote-builder.tsx` and the dropdown in `cmd-k.tsx`.
 */
export const AdminQuoteProjectType = z.enum([
  "deck",
  "pergola",
  "garage",
  "addition",
  "fence",
  "renovation",
  "flooring",
  "roofing",
  "siding",
  "interior_finish",
  "structural_repair",
  "other",
]);
export type AdminQuoteProjectType = z.infer<typeof AdminQuoteProjectType>;

export const AdminQuoteProject = z.object({
  type: AdminQuoteProjectType,
  scopeSummary: z.string().min(1).max(2000),
  // Optional dimensions — used by the AI suggest endpoint to anchor quantities.
  // For decks/additions these are footprint ft. For flooring it's room area.
  lengthFt: z.number().min(0).max(500).optional(),
  widthFt: z.number().min(0).max(500).optional(),
  // Free-form material descriptor — works for "cedar", "vinyl plank", "Hardie",
  // "engineered hardwood", etc. without forcing a tight enum across trades.
  material: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
});
export type AdminQuoteProject = z.infer<typeof AdminQuoteProject>;

// =============================================================================
// Tax mode — driven by BC PST contractor rules from the supplier primer.
// =============================================================================

/**
 *   real_property_install →  Black Timber installs material into real
 *                            property. PST is paid by Black Timber at the
 *                            supplier; NOT shown to the homeowner. Labor is
 *                            generally not PST-applicable.
 *   supply_only           →  Customer takes the materials and self-installs.
 *                            PST 7% applies, shown as a line on the quote.
 *   mixed_split           →  Some lines installed, some supply-only. Quote
 *                            must be manually split into two — the AI/UI
 *                            flags this; we don't auto-average.
 *   exempt                →  Customer holds a valid PST exemption (resale,
 *                            registered exempt, etc.). No PST shown.
 */
export const AdminQuoteTaxMode = z.enum([
  "real_property_install",
  "supply_only",
  "mixed_split",
  "exempt",
]);
export type AdminQuoteTaxMode = z.infer<typeof AdminQuoteTaxMode>;

// =============================================================================
// Server-computed totals (always recalculated on save — never trust client)
// =============================================================================

export const AdminQuoteTotals = z.object({
  subtotalCAD: z.number(),
  freightCAD: z.number(),
  gstCAD: z.number(),
  pstCAD: z.number(),
  grandTotalCAD: z.number(),
  // Cumulative max lead-time across all special-order / vendor lines.
  maxLeadTimeDays: z.number().int().min(0),
});
export type AdminQuoteTotals = z.infer<typeof AdminQuoteTotals>;

// =============================================================================
// Save / load shapes
// =============================================================================

/**
 * Document kind. Same data model, different headers / terms / footer text
 * on the printed page:
 *   quote     — formal price commitment, valid until a date.
 *   estimate  — ballpark, may move; softer tone, expectation-setting.
 *   invoice   — bill for work performed/in progress; payment terms + due date.
 *
 * IDs are prefixed accordingly (`Q-`, `E-`, `I-`) by the storage layer so
 * the same identifier-space stays unambiguous across all three types.
 */
export const AdminDocumentType = z.enum(["quote", "estimate", "invoice"]);
export type AdminDocumentType = z.infer<typeof AdminDocumentType>;

/** Shape the client POSTs when creating or updating a document. */
export const AdminQuoteInput = z.object({
  // Optional — if present, this is an update of an existing id.
  id: z
    .string()
    .regex(/^[QEI]-\d{8}-[A-Z0-9]{4}$/, "Document ID must look like Q-YYYYMMDD-XXXX")
    .optional(),
  documentType: AdminDocumentType.default("quote"),
  customer: AdminQuoteCustomer,
  project: AdminQuoteProject,
  lines: z.array(AdminQuoteLine).min(1).max(80),
  taxMode: AdminQuoteTaxMode,
  freightCAD: z.number().min(0).max(100_000).default(0),
  // ISO date string (YYYY-MM-DD). Server defaults to +7 days if omitted.
  // For invoices this is interpreted as the payment-due-by date.
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
  status: z.enum(["draft", "sent", "accepted", "declined", "paid"]).default("draft"),
  internalNotes: z.string().max(4000).optional(),
  /** Invoice-only: shown to the customer. Free-form (e.g., "Net 30"). */
  paymentTerms: z.string().max(120).optional(),
  /** Invoice-only: payment instructions block (e-transfer email, cheque to, etc). */
  paymentInstructions: z.string().max(800).optional(),
});
export type AdminQuoteInput = z.infer<typeof AdminQuoteInput>;

/** Shape the server returns after persisting a quote. Adds id + audit fields. */
export const AdminQuoteSaved = AdminQuoteInput.required({
  id: true,
  validUntil: true,
}).extend({
  totals: AdminQuoteTotals,
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
});
export type AdminQuoteSaved = z.infer<typeof AdminQuoteSaved>;

// =============================================================================
// AI line-item suggestion endpoint
// =============================================================================

export const AdminQuoteSuggestInput = z.object({
  scope: z.string().min(8).max(2000),
  project: AdminQuoteProject.partial({ scopeSummary: true }).optional(),
  // Optional location tag so the model can flag remote freight.
  location: z.string().max(200).optional(),
});
export type AdminQuoteSuggestInput = z.infer<typeof AdminQuoteSuggestInput>;

/**
 * AI returns a list of suggested line items + a notes field for caveats.
 * Quantities and prices come back as anchors — Jaryd reviews and edits before
 * the quote is sent. Per the supplier primer, the model must label every
 * line as stocked/special-order/labor/etc and never claim live stock.
 */
export const AdminQuoteSuggestOutput = z.object({
  lines: z
    .array(
      z.object({
        description: z.string().min(1).max(280),
        quantity: z.number().min(0).max(100_000),
        uom: QuoteLineUom,
        unitPriceCAD: z.number().min(0).max(1_000_000),
        source: QuoteLineSource,
        leadTimeDays: z.number().int().min(0).max(365).optional(),
        notes: z.string().max(280).optional(),
      })
    )
    .min(1)
    .max(40),
  /** Caveats, waste-factor explanations, special-order callouts. */
  notes: z.string().min(1).max(2000),
  /** Suggested freight surcharge (CAD) if the location implies remote delivery. */
  suggestedFreightCAD: z.number().min(0).max(100_000).default(0),
});
export type AdminQuoteSuggestOutput = z.infer<typeof AdminQuoteSuggestOutput>;

// =============================================================================
// AI parse endpoint — Cmd+K "talk to AI about what I'm doing"
// =============================================================================

/**
 * Free-form input from the Cmd+K modal. The user types or dictates anything
 * about the job and we hand it to the model; the model returns a structured
 * partial that the client merges into the form.
 *
 * Optional `currentForm` payload lets the model see what the user has already
 * filled in (so it doesn't overwrite a phone number with a blank if the user
 * only mentioned the address).
 */
export const AdminQuoteParseImage = z.object({
  /** data:image/... base64 or https URL */
  url: z
    .string()
    .min(20)
    .max(8_000_000)
    .refine(
      (u) => u.startsWith("data:image/") || /^https?:\/\//i.test(u),
      "Image must be a data URL or https URL"
    ),
  caption: z.string().max(120).optional(),
});
export type AdminQuoteParseImage = z.infer<typeof AdminQuoteParseImage>;

export const AdminQuoteParseInput = z
  .object({
    text: z.string().max(4000).default(""),
    /** Screenshots, text threads, supplier quotes, etc. — vision extracts into the form. */
    images: z.array(AdminQuoteParseImage).max(6).optional().default([]),
    /** Snapshot of the form fields the user has already filled. */
    currentForm: z
      .object({
        customer: AdminQuoteCustomer.partial().optional(),
        project: AdminQuoteProject.partial({ scopeSummary: true, type: true }).optional(),
        taxMode: AdminQuoteTaxMode.optional(),
        documentType: AdminDocumentType.optional(),
        lineCount: z.number().int().min(0).max(80).optional(),
      })
      .optional(),
  })
  .superRefine((val, ctx) => {
    const hasText = val.text.trim().length >= 8;
    const hasImages = (val.images?.length ?? 0) > 0;
    if (!hasText && !hasImages) {
      ctx.addIssue({
        code: "custom",
        message: "Add a description (8+ characters) or at least one image.",
        path: ["text"],
      });
    }
  });
export type AdminQuoteParseInput = z.infer<typeof AdminQuoteParseInput>;

/**
 * Partial quote draft the model returns. EVERY field is optional — the model
 * returns only what it heard / could ground from the supplier primer. The
 * client merges these into existing form state without clobbering the
 * fields the model didn't mention.
 *
 * This shape is intentionally a SUBSET of AdminQuoteInput, not the full
 * thing, because we don't want the model to hallucinate things like a doc
 * status or an internal-only note.
 */
export const AdminQuoteParseOutput = z.object({
  documentType: AdminDocumentType.optional(),
  customer: AdminQuoteCustomer.partial().optional(),
  project: AdminQuoteProject.partial().optional(),
  lines: z
    .array(
      z.object({
        description: z.string().min(1).max(280),
        quantity: z.number().min(0).max(100_000),
        uom: QuoteLineUom,
        unitPriceCAD: z.number().min(0).max(1_000_000),
        source: QuoteLineSource,
        leadTimeDays: z.number().int().min(0).max(365).optional(),
        notes: z.string().max(280).optional(),
      })
    )
    .max(40)
    .optional(),
  taxMode: AdminQuoteTaxMode.optional(),
  freightCAD: z.number().min(0).max(100_000).optional(),
  paymentTerms: z.string().max(120).optional(),
  /** Plain-language summary of what was applied so the UI can show a toast. */
  appliedSummary: z.string().min(1).max(600),
  /** Honest list of fields the model wasn't sure about, for the UI to flag. */
  uncertainties: z.array(z.string().max(280)).max(8).default([]),
});
export type AdminQuoteParseOutput = z.infer<typeof AdminQuoteParseOutput>;
