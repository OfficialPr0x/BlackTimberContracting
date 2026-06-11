/**
 * Line-item breakdown for website estimate PDFs and CRM payloads.
 */

import type { QuoteEstimateInput, QuoteEstimateResult } from "./quote-engine";
import { estimateProject } from "./quote-engine";
import { DECK_UPGRADE_USD } from "./deck-engine";

export interface EstimateLineItem {
  section: "materials" | "labor" | "permits" | "upgrade" | "summary";
  description: string;
  qty: string;
  unitPriceUSD: number;
  totalUSD: number;
}

export interface EstimateDocumentData {
  projectType: string;
  style?: string;
  material?: string;
  dimensionsLabel: string;
  measureLabel: string;
  primaryMeasure: number;
  rangeMinUSD: number;
  rangeMaxUSD: number;
  lines: EstimateLineItem[];
  scopeIncludes: string[];
  disclaimer: string;
  headline: string;
}

const UPGRADE_LABELS: Record<string, string> = {
  stairs: "Custom stairs (materials + install)",
  lighting: "LED post / step lighting",
  railing: "Black aluminum railing system",
  pergola: "Timber pergola structure",
  roof: "Covered solid patio roof",
  skirting: "Cedar skirting / fascia",
  privacy: "Privacy wall panel",
  posts: "Heavy timber post upgrade",
  staining: "Stain / seal finish",
  post_caps: "Decorative post caps",
  removal: "Remove existing fence",
  insulated_door: "Insulated overhead garage door",
  windows: "Side window(s)",
  electrical: "Electrical rough-in",
  louvered: "Louvered pergola top",
};

export function buildEstimateDocument(
  input: QuoteEstimateInput,
  ai?: {
    headline?: string;
    disclaimer?: string;
    scopeIncludes?: string[];
    minUSD?: number;
    maxUSD?: number;
  }
): EstimateDocumentData {
  const est = estimateProject(input);
  const lines: EstimateLineItem[] = [];

  if (input.projectType === "fence") {
    const style = (input.style ?? "cedar").replace(/-/g, " ");
    lines.push({
      section: "materials",
      description: `${style} fence panels, posts, rails & hardware`,
      qty: `${input.length} LF`,
      unitPriceUSD: Math.round(est.materialsUSD / Math.max(1, input.length)),
      totalUSD: est.materialsUSD,
    });
  } else {
    lines.push({
      section: "materials",
      description:
        input.projectType === "deck"
          ? `${input.material ?? "cedar"} decking, framing lumber & hardware`
          : `${input.projectType} materials package`,
      qty: `${est.primaryMeasure} sq ft`,
      unitPriceUSD: Math.round(est.materialsUSD / Math.max(1, est.primaryMeasure)),
      totalUSD: est.materialsUSD,
    });
  }

  lines.push({
    section: "labor",
    description: "Installation labor — Black Timber crew",
    qty: input.projectType === "fence" ? `${input.length} LF` : `${est.primaryMeasure} sq ft`,
    unitPriceUSD: Math.round(est.laborUSD / Math.max(1, est.primaryMeasure || input.length)),
    totalUSD: est.laborUSD,
  });

  for (const u of input.upgrades ?? []) {
    const cost = DECK_UPGRADE_USD[u as keyof typeof DECK_UPGRADE_USD] ?? estimateUpgradeFallback(u, input);
    if (cost <= 0) continue;
    lines.push({
      section: "upgrade",
      description: UPGRADE_LABELS[u] ?? u,
      qty: "1",
      unitPriceUSD: cost,
      totalUSD: cost,
    });
  }

  lines.push({
    section: "permits",
    description: "Permits, filings & inspections (RDCK / municipal)",
    qty: "1 lot",
    unitPriceUSD: est.permitsUSD,
    totalUSD: est.permitsUSD,
  });

  lines.push({
    section: "summary",
    description: "Contractor margin & project coordination",
    qty: "—",
    unitPriceUSD: est.profitUSD,
    totalUSD: est.profitUSD,
  });

  const dimLabel =
    input.projectType === "fence"
      ? `${input.length} ft run × ${input.width} ft height`
      : `${input.length} × ${input.width} ft footprint`;

  return {
    projectType: input.projectType,
    style: input.style,
    material: input.material,
    dimensionsLabel: dimLabel,
    measureLabel: est.measureLabel,
    primaryMeasure: est.primaryMeasure,
    rangeMinUSD: ai?.minUSD ?? est.minUSD,
    rangeMaxUSD: ai?.maxUSD ?? est.maxUSD,
    lines,
    scopeIncludes: ai?.scopeIncludes ?? [],
    disclaimer:
      ai?.disclaimer ??
      "Ballpark estimate from our rate card. Final price follows an on-site visit. Material costs subject to Fernie HH PRO confirmation.",
    headline: ai?.headline ?? `${input.projectType} estimate — ${dimLabel}`,
  };
}

function estimateUpgradeFallback(upgrade: string, input: QuoteEstimateInput): number {
  const map: Record<string, number> = {
    staining: Math.round((input.length || 100) * 2.5),
    post_caps: Math.round((input.length || 100) * 0.85),
    removal: Math.round((input.length || 100) * 3.5),
    insulated_door: 950,
    windows: 650,
    electrical: 1200,
    louvered: 1850,
  };
  return map[upgrade] ?? 0;
}
