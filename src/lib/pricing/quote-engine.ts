/**
 * Unified quote engine — all public-facing project types.
 * Grounded in Fernie HH / Home Hardware material ballparks + competitive
 * solo-operator labor. Used by Quote Wizard, /api/ai/quote fallback, and
 * explain-price sanity checks.
 */

import { estimateDeck, type DeckMaterial, type DeckUpgrade } from "./deck-engine";

export type QuoteProjectType =
  | "deck"
  | "fence"
  | "pergola"
  | "garage"
  | "shed"
  | "addition"
  | "other";

/** Installed $/linear ft by fence style id (see project-styles.ts). */
const FENCE_PER_LF: Record<string, number> = {
  chainlink: 22,
  "wrought-iron": 48,
  "pressure-treated": 32,
  cedar: 44,
  "friendly-neighbor": 48,
  "arch-top": 52,
  "horizontal-slat": 55,
  "board-on-board": 46,
  "ranch-rail": 28,
  "ornamental-aluminum": 42,
};

const FENCE_GATE_USD = 450;
const FENCE_CORNER_USD = 95;
const PROFIT_MARGIN = 0.18;
const RANGE_MIN = 0.98;
const RANGE_MAX = 1.05;

export interface QuoteEstimateInput {
  projectType: QuoteProjectType;
  length: number;
  width: number;
  material?: string;
  style?: string;
  upgrades?: string[];
  corners?: number;
  gates?: number;
}

export interface QuoteEstimateResult {
  minUSD: number;
  maxUSD: number;
  materialsUSD: number;
  laborUSD: number;
  permitsUSD: number;
  profitUSD: number;
  upgradesUSD: number;
  totalUSD: number;
  /** Primary sizing number shown in UI (sq ft or linear ft). */
  primaryMeasure: number;
  measureLabel: string;
}

function finishEstimate(parts: {
  materialsUSD: number;
  laborUSD: number;
  permitsUSD: number;
  upgradesUSD: number;
  primaryMeasure: number;
  measureLabel: string;
}): QuoteEstimateResult {
  const direct = parts.materialsUSD + parts.laborUSD + parts.upgradesUSD;
  const profitUSD = Math.round(direct * PROFIT_MARGIN);
  const totalUSD = direct + parts.permitsUSD + profitUSD;
  return {
    materialsUSD: parts.materialsUSD,
    laborUSD: parts.laborUSD,
    permitsUSD: parts.permitsUSD,
    upgradesUSD: parts.upgradesUSD,
    profitUSD,
    totalUSD,
    minUSD: Math.round(totalUSD * RANGE_MIN),
    maxUSD: Math.round(totalUSD * RANGE_MAX),
    primaryMeasure: parts.primaryMeasure,
    measureLabel: parts.measureLabel,
  };
}

function heightMultiplier(heightFt: number): number {
  if (heightFt <= 4) return 1;
  if (heightFt <= 5) return 1.12;
  if (heightFt <= 6) return 1.25;
  return 1.4;
}

function estimateFence(input: QuoteEstimateInput): QuoteEstimateResult {
  const runLf = input.length;
  const heightFt = input.width;
  const style = input.style ?? "cedar";
  const baseLf = FENCE_PER_LF[style] ?? FENCE_PER_LF.cedar!;
  const perLf = baseLf * heightMultiplier(heightFt);

  const materialsUSD = Math.round(runLf * perLf * 0.42);
  const laborUSD = Math.round(runLf * perLf * 0.5);
  let upgradesUSD = 0;
  const gates = input.gates ?? 0;
  const corners = input.corners ?? 0;
  upgradesUSD += gates * FENCE_GATE_USD;
  upgradesUSD += corners * FENCE_CORNER_USD;

  for (const u of input.upgrades ?? []) {
    if (u === "staining") upgradesUSD += Math.round(runLf * 2.5);
    if (u === "post_caps") upgradesUSD += Math.round(runLf * 0.85);
    if (u === "removal") upgradesUSD += Math.round(runLf * 3.5);
  }

  return finishEstimate({
    materialsUSD,
    laborUSD,
    permitsUSD: runLf > 200 ? 425 : 275,
    upgradesUSD,
    primaryMeasure: runLf,
    measureLabel: "linear ft",
  });
}

function estimateFootprint(
  input: QuoteEstimateInput,
  rates: { mat: number; labor: number; permit: number }
): QuoteEstimateResult {
  const sqft = input.length * input.width;
  const materialsUSD = Math.round(sqft * rates.mat);
  const laborUSD = Math.round(sqft * rates.labor);
  let upgradesUSD = 0;
  for (const u of input.upgrades ?? []) {
    if (u === "lighting") upgradesUSD += 575;
    if (u === "insulated_door") upgradesUSD += 950;
    if (u === "windows") upgradesUSD += 650;
    if (u === "electrical") upgradesUSD += 1200;
    if (u === "louvered") upgradesUSD += 1850;
  }
  return finishEstimate({
    materialsUSD,
    laborUSD,
    permitsUSD: rates.permit,
    upgradesUSD,
    primaryMeasure: sqft,
    measureLabel: "sq ft",
  });
}

const DECK_UPGRADES = new Set([
  "stairs", "lighting", "railing", "pergola", "roof", "skirting", "privacy", "posts",
]);

export function estimateProject(input: QuoteEstimateInput): QuoteEstimateResult {
  switch (input.projectType) {
    case "deck": {
      const mat: DeckMaterial =
        input.material === "treated" || input.material === "cedar" || input.material === "composite"
          ? input.material
          : "cedar";
      const est = estimateDeck({
        length: input.length,
        width: input.width,
        material: mat,
        upgrades: (input.upgrades ?? []).filter((u): u is DeckUpgrade =>
          DECK_UPGRADES.has(u)
        ),
      });
      return {
        minUSD: est.minUSD,
        maxUSD: est.maxUSD,
        materialsUSD: est.materialsUSD + est.upgradesUSD,
        laborUSD: est.laborUSD + est.profitUSD,
        permitsUSD: est.permitsUSD,
        profitUSD: est.profitUSD,
        upgradesUSD: est.upgradesUSD,
        totalUSD: est.totalUSD,
        primaryMeasure: est.areaSqFt,
        measureLabel: "sq ft",
      };
    }
    case "fence":
      return estimateFence(input);
    case "pergola":
      return estimateFootprint(input, { mat: 11, labor: 14, permit: 350 });
    case "garage":
      return estimateFootprint(input, { mat: 20, labor: 24, permit: 850 });
    case "shed":
      return estimateFootprint(input, { mat: 12, labor: 14, permit: 400 });
    case "addition":
      return estimateFootprint(input, { mat: 48, labor: 42, permit: 1200 });
    default:
      return estimateFootprint(input, { mat: 15, labor: 18, permit: 500 });
  }
}

export const PROJECT_TYPE_OPTIONS: {
  id: QuoteProjectType;
  label: string;
  desc: string;
}[] = [
  { id: "deck", label: "Deck", desc: "Outdoor living platform" },
  { id: "fence", label: "Fence", desc: "Privacy, chain, cedar & more" },
  { id: "pergola", label: "Pergola", desc: "Shade & timber structure" },
  { id: "garage", label: "Garage", desc: "Detached garage build" },
  { id: "shed", label: "Shed", desc: "Storage & workshop" },
  { id: "addition", label: "Addition", desc: "Home expansion" },
  { id: "other", label: "Other", desc: "Custom structural work" },
];
