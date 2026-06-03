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

export const AdminQuoteProject = z.object({
  type: z.enum(["deck", "pergola", "garage", "addition", "fence", "renovation", "other"]),
  scopeSummary: z.string().min(1).max(2000),
  // Optional dimensions — used by the AI suggest endpoint to anchor quantities.
  lengthFt: z.number().min(0).max(200).optional(),
  widthFt: z.number().min(0).max(200).optional(),
  material: z.enum(["treated", "cedar", "composite", "mixed", "other"]).optional(),
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

/** Shape the client POSTs when creating or updating a quote. */
export const AdminQuoteInput = z.object({
  // Optional — if present, this is an update of an existing quote id.
  id: z.string().regex(/^Q-\d{8}-[A-Z0-9]{4}$/).optional(),
  customer: AdminQuoteCustomer,
  project: AdminQuoteProject,
  lines: z.array(AdminQuoteLine).min(1).max(80),
  taxMode: AdminQuoteTaxMode,
  freightCAD: z.number().min(0).max(100_000).default(0),
  // ISO date string (YYYY-MM-DD). Server defaults to +7 days if omitted.
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
  status: z.enum(["draft", "sent", "accepted", "declined"]).default("draft"),
  internalNotes: z.string().max(4000).optional(),
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
