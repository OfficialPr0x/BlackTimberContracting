/**
 * Black Timber pricing model — the "algorithm" behind the onsite estimator.
 *
 * Philosophy (from Jaryd): NOT the cheapest. The most *understandable* and
 * *trustworthy*. Every estimate the AI assembles must be:
 *   - Transparent: line items the homeowner can read and sanity-check.
 *   - Honest: stocked vs special-order, desk-confirm language, freight flagged.
 *   - Fairly priced: real Kootenay labor + a healthy-but-reasonable margin,
 *     never a lowball that gets clawed back with change orders later.
 *
 * These are PLANNING anchors layered on top of the Fernie HH supplier primer
 * (supplier-knowledge.ts). The supplier primer carries the per-material
 * ballparks; this file carries the labor rates, markup, and job-level adders
 * that turn a material list into a Black Timber price.
 *
 * Tune these and bump PROMPT_VERSIONS.admin_estimator so old logs stay
 * traceable.
 */

export const PRICING_CONFIG = {
  /** Crew labor — East Kootenay 2026, loaded (wage + overhead + small tools). */
  labor: {
    leadCarpenterHourlyCAD: 85,
    carpenterHourlyCAD: 70,
    laborerHourlyCAD: 50,
    /** Typical billable crew-day (lead + helper, ~8 hr productive). */
    crewDayCAD: 1100,
  },

  /**
   * Material markup over supplier cost. Covers pickup/delivery runs, handling,
   * returns, waste on offcuts, and carrying cost. Applied to the supplier
   * ballpark, NOT stacked on top of an already-installed $/sqft rate.
   */
  materialMarkup: {
    /** Standard markup on supplier material cost. */
    standardPct: 0.18,
    /** Special-order / freight-heavy items carry a bit more handling risk. */
    specialOrderPct: 0.22,
  },

  /**
   * Job-level adders. The estimator should include these as their own honest
   * line items rather than hiding them inside material prices.
   */
  jobAdders: {
    /** Mobilization / site setup for a small job (one-trip jobs). */
    mobilizationCAD: 150,
    /** Disposal / dump run when tear-out is involved. */
    disposalCADRange: [120, 450] as const,
    /** Permit coordination & drawings when a job needs a building permit. */
    permitCoordinationCADRange: [250, 750] as const,
    /** Minimum job size — below this it's not worth mobilizing a crew. */
    minimumJobCAD: 450,
  },

  /**
   * Contingency the estimator may add as a visible line on larger / unknown
   * scopes (e.g. opening up a wall, unknown subfloor condition). Always shown
   * and explained — never buried.
   */
  contingency: {
    standardPct: 0.1,
    unknownConditionsPct: 0.15,
  },

  /** Default validity window on a quote/estimate (days). */
  defaultValidityDays: 7,
} as const;

/**
 * Prompt-ready pricing primer. Injected into the estimator system prompt so
 * the model prices like Black Timber, not like a generic calculator.
 */
export const PRICING_PHILOSOPHY = `
BLACK TIMBER PRICING MODEL — how to price like Jaryd onsite

Positioning: NOT the cheapest bid. The clearest, most trustworthy one. Homeowners
should finish reading the estimate and think "I know exactly what I'm paying for
and why." Win on transparency and craftsmanship, never on being the low number.

Labor rates (East Kootenay 2026, loaded):
  - Lead carpenter: $${PRICING_CONFIG.labor.leadCarpenterHourlyCAD}/hr
  - Carpenter: $${PRICING_CONFIG.labor.carpenterHourlyCAD}/hr
  - Laborer: $${PRICING_CONFIG.labor.laborerHourlyCAD}/hr
  - Typical crew-day (lead + helper): $${PRICING_CONFIG.labor.crewDayCAD}/day
  Use the per-sqft / per-LF installed labor ranges from the supplier primer for
  finish trades (flooring, trim, siding, roofing). Use hourly/crew-day for
  framing, repairs, demo, and anything not cleanly measured per unit.

Material markup (over the supplier ballpark):
  - Standard stocked material: +${Math.round(PRICING_CONFIG.materialMarkup.standardPct * 100)}%
  - Special-order / freight-heavy: +${Math.round(PRICING_CONFIG.materialMarkup.specialOrderPct * 100)}%
  Do NOT also mark up an already-installed $/sqft finish rate — those rates
  already include material + labor + margin.

Always-visible job adders (their own honest line items, never hidden):
  - Mobilization / site setup (small jobs): ~$${PRICING_CONFIG.jobAdders.mobilizationCAD}
  - Disposal / dump run when tear-out exists: $${PRICING_CONFIG.jobAdders.disposalCADRange[0]}–$${PRICING_CONFIG.jobAdders.disposalCADRange[1]}
  - Permit coordination + drawings when a permit is needed: $${PRICING_CONFIG.jobAdders.permitCoordinationCADRange[0]}–$${PRICING_CONFIG.jobAdders.permitCoordinationCADRange[1]}
  - Minimum job: $${PRICING_CONFIG.jobAdders.minimumJobCAD} (flag if scope is below this)

Contingency (shown + explained on larger/unknown scopes):
  - Standard: +${Math.round(PRICING_CONFIG.contingency.standardPct * 100)}%
  - Unknown conditions (open walls, unknown subfloor, old structure): +${Math.round(PRICING_CONFIG.contingency.unknownConditionsPct * 100)}%

Waste factors: apply the per-material waste % from the supplier primer to
quantities (framing +5–10%, decking +8–12%, drywall +10–15%, flooring +8% rect /
+15% diagonal, tile +10%, fasteners +15%).

Hard pricing rules:
  - Every line gets a source tag: fernie_hh_stocked, fernie_hh_special_order,
    other_supplier, labor, subcontractor, or other.
  - Currency is CAD. BC tax: installed-into-real-property work →
    real_property_install (GST 5% only, no PST line to the homeowner). Supply-only
    material the customer self-installs → supply_only (GST + PST 7%). Mixed →
    flag for a split, don't average.
  - Flag freight for remote/backcountry job sites (Island Lake, Hartley Lake Rd,
    lake-access, etc.).
  - These are planning anchors — close with "final price subject to a Black
    Timber site confirmation / Fernie HH PRO desk check." Never claim live stock.
`.trim();
