/**
 * Quote totals — shared by server save path and client preview/builder.
 * Kept separate from quotes.ts so client components never import server-only FS.
 */

import type {
  AdminQuoteLine,
  AdminQuoteTaxMode,
  AdminQuoteTotals,
} from "./schemas";

const GST_RATE = 0.05;
const PST_RATE = 0.07;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Compute every total field from raw line items + tax mode + freight.
 *
 * BC tax model (per src/lib/openrouter/supplier-knowledge.ts):
 *   real_property_install →  GST 5% on (subtotal + freight). NO PST shown
 *   supply_only           →  GST 5% AND PST 7%, both on (subtotal + freight).
 *   mixed_split           →  Same as supply_only (conservative until split).
 *   exempt                →  GST 5%, no PST.
 */
export function computeQuoteTotals(
  lines: AdminQuoteLine[],
  taxMode: AdminQuoteTaxMode,
  freightCAD: number
): AdminQuoteTotals {
  const subtotalCAD = round2(
    lines.reduce((acc, l) => acc + l.quantity * l.unitPriceCAD, 0)
  );
  const taxableBase = round2(subtotalCAD + freightCAD);

  const gstCAD = round2(taxableBase * GST_RATE);
  const pstCAD =
    taxMode === "supply_only" || taxMode === "mixed_split"
      ? round2(taxableBase * PST_RATE)
      : 0;

  const grandTotalCAD = round2(taxableBase + gstCAD + pstCAD);

  let maxLeadTimeDays = 0;
  for (const l of lines) {
    if (typeof l.leadTimeDays === "number" && l.leadTimeDays > maxLeadTimeDays) {
      maxLeadTimeDays = l.leadTimeDays;
    }
  }

  return {
    subtotalCAD,
    freightCAD: round2(freightCAD),
    gstCAD,
    pstCAD,
    grandTotalCAD,
    maxLeadTimeDays,
  };
}
