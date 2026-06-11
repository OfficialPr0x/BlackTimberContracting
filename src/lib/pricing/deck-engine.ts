/**
 * Live deck pricing engine — single source of truth for the cost calculator,
 * quote wizard fallback, and AI quote deterministic fallback.
 *
 * Grounded in Fernie HH / Home Hardware contractor material ballparks (see
 * supplier-knowledge.ts) plus efficient solo-operator labor. Rates are
 * INSTALLED-market competitive for East Kootenay — win work without giving
 * it away. A ~18% margin sits on direct cost (materials + labor + upgrades);
 * permits are passed through at realistic RDCK filing costs.
 */

export type DeckMaterial = "treated" | "cedar" | "composite";

export type DeckUpgrade =
  | "stairs"
  | "lighting"
  | "railing"
  | "pergola"
  | "roof"
  | "skirting"
  | "privacy"
  | "posts";

/** Materials-only $/sqft at PRO desk pricing (decking + framing + hardware). */
const MATERIAL_SQFT: Record<DeckMaterial, number> = {
  treated: 8.5,
  cedar: 13.5,
  composite: 20,
};

/** Install labor $/sqft — efficient rectangle, ground-level to low-elevation. */
const LABOR_SQFT: Record<DeckMaterial, number> = {
  treated: 10,
  cedar: 12,
  composite: 14,
};

/** Flat add-ons (materials + labor bundled). Sized for typical Kootenay jobs. */
export const DECK_UPGRADE_USD: Record<DeckUpgrade, number> = {
  stairs: 850,
  lighting: 575,
  railing: 1250,
  pergola: 2850,
  roof: 3950,
  skirting: 725,
  privacy: 950,
  posts: 650,
};

/** Margin on direct build cost (materials + labor + upgrades). Permits at cost. */
const PROFIT_MARGIN = 0.18;

/** Tight range — confident pricing, not padded. */
const RANGE_MIN_FACTOR = 0.98;
const RANGE_MAX_FACTOR = 1.05;

function permitFee(areaSqFt: number): number {
  if (areaSqFt <= 120) return 325;
  if (areaSqFt <= 250) return 425;
  if (areaSqFt <= 400) return 525;
  return 650;
}

export interface DeckEstimateInput {
  length: number;
  width: number;
  material: DeckMaterial;
  /** Boolean map (calculator) or string list (quote wizard). */
  upgrades?: Partial<Record<DeckUpgrade, boolean>> | DeckUpgrade[];
}

export interface DeckEstimateResult {
  areaSqFt: number;
  materialsUSD: number;
  laborUSD: number;
  permitsUSD: number;
  upgradesUSD: number;
  profitUSD: number;
  totalUSD: number;
  minUSD: number;
  maxUSD: number;
}

function activeUpgrades(input: DeckEstimateInput): DeckUpgrade[] {
  const u = input.upgrades;
  if (!u) return [];
  if (Array.isArray(u)) return u;
  return (Object.keys(u) as DeckUpgrade[]).filter((k) => u[k]);
}

export function estimateDeck(input: DeckEstimateInput): DeckEstimateResult {
  const areaSqFt = input.length * input.width;
  const materialsUSD = Math.round(areaSqFt * MATERIAL_SQFT[input.material]);
  const laborUSD = Math.round(areaSqFt * LABOR_SQFT[input.material]);
  const permitsUSD = permitFee(areaSqFt);

  let upgradesUSD = 0;
  for (const key of activeUpgrades(input)) {
    upgradesUSD += DECK_UPGRADE_USD[key] ?? 0;
  }

  const directBuild = materialsUSD + laborUSD + upgradesUSD;
  const profitUSD = Math.round(directBuild * PROFIT_MARGIN);
  const totalUSD = directBuild + permitsUSD + profitUSD;
  const minUSD = Math.round(totalUSD * RANGE_MIN_FACTOR);
  const maxUSD = Math.round(totalUSD * RANGE_MAX_FACTOR);

  return {
    areaSqFt,
    materialsUSD,
    laborUSD,
    permitsUSD,
    upgradesUSD,
    profitUSD,
    totalUSD,
    minUSD,
    maxUSD,
  };
}

/** Legacy-style $/sqft all-in (for display / docs). */
export const DECK_INSTALLED_RATE_HINT: Record<DeckMaterial, number> = {
  treated: 26,
  cedar: 32,
  composite: 42,
};
