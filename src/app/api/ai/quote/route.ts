/**
 * POST /api/ai/quote
 *
 * Body: QuoteInput (see src/lib/openrouter/schemas.ts)
 * Returns: QuoteOutput (structured estimate with breakdown, timeline, risks)
 *
 * Vision-enabled — accepts up to 6 photos as data URLs or remote URLs.
 * The model reads them alongside the project specs and produces a defensible
 * range with regional Kootenay context baked in.
 */

import { errorResponse } from "@/lib/openrouter/errors";
import { chatJSON, type ChatMessage, type ContentPart } from "@/lib/openrouter/client";
import { QuoteInput, QuoteOutput, type QuoteOutput as QuoteOutputT } from "@/lib/openrouter/schemas";
import { QUOTE_PROMPT } from "@/lib/openrouter/prompts";
import { checkRate } from "@/lib/rate-limit";
import { AiError } from "@/lib/openrouter/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    checkRate(req, "quote");

    const json = await req.json().catch(() => null);
    if (!json) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Couldn't read your request body.",
      });
    }

    const parsed = QuoteInput.safeParse(json);
    if (!parsed.success) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Some required fields are missing or invalid. Please review and resubmit.",
        message: parsed.error.message,
      });
    }
    const input = parsed.data;

    // Build the user-message content. Text first, then any photos as
    // image_url parts (OpenAI-compatible multimodal format).
    const text = formatQuoteUserMessage(input);
    const content: ContentPart[] = [{ type: "text", text }];
    for (const photo of input.photos ?? []) {
      content.push({ type: "image_url", image_url: { url: photo.url, detail: "auto" } });
    }

    const messages: ChatMessage[] = [
      { role: "system", content: QUOTE_PROMPT },
      { role: "user", content },
    ];

    let result: QuoteOutputT;
    let usedFallback = false;
    try {
      result = await chatJSON({
        task: "quote",
        schema: QuoteOutput,
        schemaName: "QuoteOutput",
        messages,
        temperature: 0.2,
      });
    } catch (err) {
      console.warn(
        `[quote] AI failed, returning deterministic fallback: ${err instanceof Error ? err.message : String(err)}`
      );
      result = deterministicQuote(input);
      usedFallback = true;
    }

    // Sanity guard: min must be ≤ max.
    if (result.estimate.minUSD > result.estimate.maxUSD) {
      [result.estimate.minUSD, result.estimate.maxUSD] = [
        result.estimate.maxUSD,
        result.estimate.minUSD,
      ];
    }

    return Response.json({ ...result, usedFallback });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Deterministic fallback when AI is unavailable. Same math as the client-side
 * calculator, but wrapped in the QuoteOutput shape with honest copy so the
 * customer always gets a useful estimate.
 */
function deterministicQuote(input: QuoteInput): QuoteOutputT {
  const area = input.dimensions.length * input.dimensions.width;
  const matRate = input.material === "cedar" ? 65 : input.material === "composite" ? 85 : input.material === "treated" ? 45 : 60;
  const addOnMap: Record<string, number> = {
    stairs: 1800, lighting: 1200, railing: 2500, pergola: 5500, roof: 8000,
    skirting: 1500, privacy: 1800, posts: 2200,
  };
  let subtotal = area * matRate;
  for (const u of input.upgrades) subtotal += addOnMap[u] ?? 0;

  const min = Math.round(subtotal * 0.9);
  const max = Math.round(subtotal * 1.15);

  return {
    estimate: { minUSD: min, maxUSD: max, confidence: "low" },
    breakdown: {
      materialsUSD: Math.round(subtotal * 0.45),
      laborUSD: Math.round(subtotal * 0.40),
      permitsAndFeesUSD: Math.round(subtotal * 0.15),
    },
    timelineWeeks: { min: Math.max(2, Math.ceil(area / 200)), max: Math.max(4, Math.ceil(area / 120)) },
    scopeIncludes: [
      `${input.material === "cedar" ? "Western Red Cedar" : input.material === "composite" ? "TimberTech composite" : "Pressure-treated"} planking`,
      "Simpson Strong-Tie structural connectors",
      "Helical pile or engineered concrete footings",
      "Weather-resistant flashing & moisture barrier",
      ...input.upgrades,
    ],
    riskFactors: [
      "Slope, access, or hidden rot can push this outside the range.",
      "Permit pathway depends on jurisdiction — confirm at site visit.",
    ],
    regionalNotes:
      "Standard Kootenay range with 48\" frost-line footings and BC Region 4 snow load assumptions. Final price requires a site visit.",
    headline: `${input.dimensions.length}×${input.dimensions.width} ${input.material} ${input.projectType} — ballpark estimate`,
    disclaimer:
      "Deterministic fallback estimate. AI was unavailable, so we used our base rate card. Final price requires an in-person site visit by Jaryd.",
  };
}

function formatQuoteUserMessage(input: QuoteInput): string {
  const lines = [
    `Project type: ${input.projectType}`,
    `Dimensions: ${input.dimensions.length} ft × ${input.dimensions.width} ft (${
      input.dimensions.length * input.dimensions.width
    } sq ft)`,
    `Material: ${input.material}`,
    `Upgrades: ${input.upgrades.length ? input.upgrades.join(", ") : "none selected"}`,
  ];
  if (input.location) lines.push(`Location: ${input.location}`);
  if (input.notes) lines.push("", "Client notes:", input.notes);
  if ((input.photos?.length ?? 0) > 0) {
    lines.push("", `${input.photos!.length} photo(s) attached — analyze them carefully.`);
  }
  lines.push("", "Produce a structured estimate matching the JSON schema exactly.");
  return lines.join("\n");
}
