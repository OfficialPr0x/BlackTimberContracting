import { z } from "zod";

export const ProspectSearchInput = z.object({
  focus: z.string().min(4).max(1200).default(
    "General contractors, design-build firms, and residential developers in the East Kootenay for subcontracting (decks, exterior, finishing) or collaboration."
  ),
  region: z.string().max(200).default("East Kootenay, BC"),
  saveResults: z.boolean().default(true),
});

export type ProspectSearchInput = z.infer<typeof ProspectSearchInput>;

// -----------------------------------------------------------------------------
// Self-healing output schema.
//
// The synthesis model (often a fast model like Gemini Flash) returns *almost*
// the right shape but trips strict validation: enum values like "GC" or
// "residential developer", fitScore as a string/float, null instead of an
// omitted field, extra array items, or the whole object wrapped in
// { data: … }. Rather than reject the entire response (and show the user "no
// leads"), we coerce/normalize every field and salvage records individually.
// -----------------------------------------------------------------------------

const PROSPECT_TYPES = [
  "developer",
  "general_contractor",
  "builder",
  "design_build",
  "property_manager",
  "other",
] as const;
type ProspectType = (typeof PROSPECT_TYPES)[number];

function normalizeType(v: unknown): ProspectType {
  const s = String(v ?? "")
    .toLowerCase()
    .replace(/[\s/-]+/g, "_");
  if ((PROSPECT_TYPES as readonly string[]).includes(s)) return s as ProspectType;
  if (s.includes("develop")) return "developer";
  if (s.includes("design") && s.includes("build")) return "design_build";
  if (s.includes("property") || s.includes("strata") || s.includes("manage")) {
    return "property_manager";
  }
  if (s === "gc" || s.includes("general") || s.includes("contractor")) {
    return "general_contractor";
  }
  if (s.includes("build") || s.includes("home") || s.includes("custom")) return "builder";
  return "other";
}

function clampScore(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(0, n));
}

/** Optional string that tolerates null/number and trims to a max length. */
const optStr = (max: number) =>
  z.preprocess(
    (v) => (v === null || v === undefined || v === "" ? undefined : String(v).slice(0, max)),
    z.string().max(max).optional()
  );

/** Required string with a graceful fallback when the model omits it. */
const reqStr = (max: number, fallback: string) =>
  z.preprocess((v) => {
    const t = (v === null || v === undefined ? "" : String(v)).trim();
    return t ? t.slice(0, max) : fallback;
  }, z.string().min(1).max(max));

export const ProspectRecord = z.object({
  companyName: z.preprocess(
    (v) => (v === null || v === undefined ? "" : String(v).trim().slice(0, 200)),
    z.string().min(1).max(200)
  ),
  website: optStr(500),
  location: optStr(200),
  prospectType: z.preprocess(normalizeType, z.enum(PROSPECT_TYPES)),
  fitScore: z.preprocess(clampScore, z.number().int().min(0).max(100)),
  fitReason: reqStr(2000, "Potential fit — review and verify."),
  collaborationAngle: reqStr(2000, "Reach out to explore a subtrade or partnership."),
  suggestedContact: optStr(500),
  sourceUrl: optStr(500),
  portfolioMatchNotes: optStr(1500),
});

export type ProspectRecord = z.infer<typeof ProspectRecord>;

/** Coerce to an array of clean strings, dropping blanks and capping length. */
const strList = (max: number) =>
  z
    .preprocess((v) => (Array.isArray(v) ? v : []), z.array(z.unknown()))
    .transform((arr) =>
      arr
        .map((x) => (x === null || x === undefined ? "" : String(x)))
        .filter((s) => s.trim())
        .slice(0, max)
    );

/** Parse each prospect independently; keep the good ones, drop the broken. */
const prospectList = z
  .preprocess((v) => (Array.isArray(v) ? v : []), z.array(z.unknown()))
  .transform((arr) => {
    const out: ProspectRecord[] = [];
    for (const x of arr) {
      const r = ProspectRecord.safeParse(x);
      if (r.success) out.push(r.data);
    }
    return out.slice(0, 25);
  });

/** Unwrap common wrappers the model sometimes adds around the real object. */
function unwrap(v: unknown): unknown {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    if ("prospects" in o || "summary" in o) return o;
    for (const k of ["data", "result", "output", "response", "ProspectSearchOutput"]) {
      const nested = o[k];
      if (nested && typeof nested === "object") return nested;
    }
  }
  return v;
}

export const ProspectSearchOutput = z.preprocess(
  unwrap,
  z.object({
    summary: reqStr(4000, "Prospect search complete."),
    prospects: prospectList,
    searchQueriesUsed: strList(12),
    nextSteps: strList(10),
  })
);

export type ProspectSearchOutput = z.infer<typeof ProspectSearchOutput>;
