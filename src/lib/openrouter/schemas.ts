/**
 * Zod schemas for every structured-output AI call. Two reasons we hold the
 * line on this:
 *   1. The model sometimes returns garbage even with json_schema mode enforced.
 *      Validating with Zod is the difference between a clear "schema_violation"
 *      error and a runtime crash in the UI.
 *   2. The same Zod schema feeds OpenRouter's `response_format` as a JSON Schema
 *      (via zodToJsonSchema). Single source of truth for both input + output.
 *
 * Keep these schemas tight — looser = more hallucinations slip through.
 */

import { z } from "zod";

// =============================================================================
// /api/ai/quote
// =============================================================================

export const QuoteInput = z.object({
  projectType: z.enum(["deck", "pergola", "garage", "shed", "addition", "fence", "other"]),
  dimensions: z.object({
    length: z.number().min(4).max(500),
    width: z.number().min(3).max(80),
  }),
  material: z.enum(["treated", "cedar", "composite", "other"]),
  upgrades: z.array(z.string()).max(20),
  notes: z.string().max(2000).optional(),
  photos: z
    .array(
      z.object({
        // Data URL (data:image/...;base64,...) or absolute http(s) URL.
        url: z.string().min(20).max(8_000_000),
        kind: z.enum(["yard", "sketch", "inspiration", "other"]).default("yard"),
      })
    )
    .max(6)
    .optional()
    .default([]),
  // Free-form site location string. Used for Kootenay-specific reasoning.
  location: z.string().max(200).optional(),
  // Style id from project-styles (fence, garage, pergola, etc.).
  style: z.string().max(80).optional(),
  // Fence-specific — length = run (ft), width = height (ft) in dimensions.
  corners: z.number().int().min(0).max(20).optional(),
  gates: z.number().int().min(0).max(10).optional(),
});
export type QuoteInput = z.infer<typeof QuoteInput>;

export const QuoteOutput = z.object({
  estimate: z.object({
    minUSD: z.number().int().nonnegative(),
    maxUSD: z.number().int().nonnegative(),
    confidence: z.enum(["high", "medium", "low"]),
  }),
  breakdown: z.object({
    materialsUSD: z.number().int().nonnegative(),
    laborUSD: z.number().int().nonnegative(),
    permitsAndFeesUSD: z.number().int().nonnegative(),
  }),
  timelineWeeks: z.object({
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
  }),
  scopeIncludes: z.array(z.string()).max(12).default([]),
  riskFactors: z.array(z.string()).max(8).default([]),
  regionalNotes: z.string().max(800).default(""),
  headline: z.string().min(1).max(140),
  disclaimer: z.string().min(1).max(400),
});
export type QuoteOutput = z.infer<typeof QuoteOutput>;

// =============================================================================
// /api/ai/site-intel
// =============================================================================

export const SiteIntelInput = z.object({
  address: z.string().min(4).max(300),
});
export type SiteIntelInput = z.infer<typeof SiteIntelInput>;

export const SiteIntelOutput = z.object({
  resolvedLocation: z.string().max(300),
  region: z.string().max(120),
  terrain: z.object({
    slopePercent: z.number().min(0).max(100),
    slopeDifficulty: z.enum(["mild", "moderate", "steep", "extreme"]),
    elevationMeters: z.number().int().min(0).max(6000),
  }),
  climate: z.object({
    snowLoadKPa: z.number().min(0).max(20),
    snowLoadCategory: z.enum(["standard", "heavy", "extreme"]),
    frostLineInches: z.number().int().min(0).max(120),
    sunHoursPerDay: z.number().min(0).max(16),
    windCategory: z.enum(["sheltered", "moderate", "alpine_exposed"]),
  }),
  permitting: z.object({
    authority: z.string().max(200),
    typicalRequirements: z.string().max(600),
    needsEngineerStamp: z.boolean(),
  }),
  suggestedMaterials: z.array(z.string()).max(8).default([]),
  styleInspirations: z
    .array(z.object({ city: z.string().max(80), style: z.string().max(120) }))
    .max(4)
    .default([]),
  confidence: z.enum(["high", "medium", "low"]),
  sources: z.array(z.string().max(400)).max(8).default([]),
});
export type SiteIntelOutput = z.infer<typeof SiteIntelOutput>;

// =============================================================================
// /api/ai/draw-render
// =============================================================================

export const DrawRenderInput = z
  .object({
    // Canvas PNG as a data URL (data:image/png;base64,...).
    sketchDataUrl: z.string().startsWith("data:image/").max(8_000_000).optional(),
    // Client's yard / space photo to composite the mockup into.
    sitePhotoDataUrl: z.string().startsWith("data:image/").max(8_000_000).optional(),
    template: z.enum(["deck", "fence", "garage", "pergola", "other"]).default("deck"),
    // Style id from project-styles catalog (e.g. "chainlink", "cedar", "friendly-neighbor").
    style: z.string().max(80).optional(),
    dimensions: z
      .object({
        lengthFt: z.number().min(0).max(500).optional(),
        widthFt: z.number().min(0).max(200).optional(),
        corners: z.number().int().min(0).max(20).optional(),
        gates: z.number().int().min(0).max(10).optional(),
      })
      .optional(),
    // Optional free-form intent from the client ("make it L-shaped, hot tub corner").
    intent: z.string().max(500).optional(),
  })
  .refine((d) => d.sketchDataUrl || d.sitePhotoDataUrl, {
    message: "Provide a sketch and/or a site photo.",
  });
export type DrawRenderInput = z.infer<typeof DrawRenderInput>;

// Notes on min/max constraints: we keep upper bounds tight (anti-abuse,
// keeps token cost predictable) but relax lower bounds. The model can return
// a single-word feature or a 5-character interpretation if that's all the
// sketch supports — that's still useful UX, better than a 502.
export const DrawRenderOutput = z.object({
  interpretation: z.string().min(1).max(800),
  detectedFeatures: z.array(z.string()).max(12).default([]),
  approximateDimensions: z.object({
    length: z.number().min(0).max(80),
    width: z.number().min(0).max(80),
    notes: z.string().max(200).optional(),
  }),
  designNotes: z.string().min(1).max(400),
  recommendedUpgrades: z.array(z.string()).max(6).default([]),
});
export type DrawRenderOutput = z.infer<typeof DrawRenderOutput>;

// =============================================================================
// /api/ai/explain-price
// =============================================================================

export const ExplainPriceInput = z.object({
  length: z.number().min(4).max(80),
  width: z.number().min(4).max(80),
  material: z.enum(["treated", "cedar", "composite"]),
  upgrades: z.record(z.string(), z.boolean()),
  deterministicRangeUSD: z.object({
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
  }),
});
export type ExplainPriceInput = z.infer<typeof ExplainPriceInput>;

export const ExplainPriceOutput = z.object({
  narrative: z.string().min(1).max(1200),
  // Sanity-checked range. If model disagrees with our deterministic math by
  // more than ~25%, the route logs a warning so we can tune the JS coefficients.
  adjustedRangeUSD: z.object({
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
  }),
  experienceNote: z.string().min(1).max(400),
  callouts: z.array(z.string()).max(5).default([]),
});
export type ExplainPriceOutput = z.infer<typeof ExplainPriceOutput>;

// =============================================================================
// /api/leads
// =============================================================================

export const LeadInput = z.object({
  source: z.enum([
    "quote_wizard",
    "site_intel_report",
    "explain_price",
    "concierge_chat",
    "exit_intent",
    "footer",
  ]),
  contact: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email().max(200),
    phone: z.string().min(7).max(40).optional(),
    address: z.string().max(300).optional(),
  }),
  // Arbitrary JSON payload — the quote, the site report, the chat transcript, etc.
  payload: z.record(z.string(), z.unknown()).optional(),
  // Anti-spam honeypot. Accepts any string (real users send ""). The route
  // checks .length > 0 and silently 200s WITHOUT delivering, so the bot
  // never learns it was caught.
  website: z.string().max(2000).optional(),
});
export type LeadInput = z.infer<typeof LeadInput>;
