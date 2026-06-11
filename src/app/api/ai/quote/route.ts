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
import { estimateProject, type QuoteProjectType } from "@/lib/pricing/quote-engine";

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
  const pt = input.projectType as QuoteProjectType;
  const est = estimateProject({
    projectType: pt,
    length: input.dimensions.length,
    width: input.dimensions.width,
    material: input.material,
    style: input.style,
    upgrades: input.upgrades,
    corners: input.corners,
    gates: input.gates,
  });

  const dimLabel =
    pt === "fence"
      ? `${input.dimensions.length} ft run × ${input.dimensions.width} ft height`
      : `${input.dimensions.length}×${input.dimensions.width} ft (${est.primaryMeasure} ${est.measureLabel})`;

  return {
    estimate: { minUSD: est.minUSD, maxUSD: est.maxUSD, confidence: "low" },
    breakdown: {
      materialsUSD: est.materialsUSD + est.upgradesUSD,
      laborUSD: est.laborUSD + est.profitUSD,
      permitsAndFeesUSD: est.permitsUSD,
    },
    timelineWeeks: timelineForType(pt, est.primaryMeasure),
    scopeIncludes: scopeForType(input),
    riskFactors: [
      "Slope, access, or hidden rot/complexity can push this outside the range.",
      "Permit pathway depends on jurisdiction — confirm at site visit.",
      input.projectType === "fence" && (input.gates ?? 0) > 0
        ? "Gate hardware and post sizing confirmed on site."
        : "Material pricing subject to Fernie HH PRO desk confirmation.",
    ].filter(Boolean) as string[],
    regionalNotes:
      "East Kootenay pricing anchored to Fernie Home Hardware contractor material costs plus install labor. Final price requires a site visit.",
    headline: `${input.projectType} — ${dimLabel} ballpark`,
    disclaimer:
      "Deterministic fallback estimate from our rate card. AI was unavailable. Final price requires an in-person site visit by Jaryd.",
  };
}

function timelineForType(type: QuoteProjectType, measure: number): { min: number; max: number } {
  if (type === "fence") return { min: 1, max: Math.max(2, Math.ceil(measure / 120)) };
  if (type === "shed") return { min: 1, max: 2 };
  if (type === "garage") return { min: 2, max: 4 };
  if (type === "addition") return { min: 4, max: 10 };
  return { min: Math.max(1, Math.ceil(measure / 250)), max: Math.max(2, Math.ceil(measure / 150)) };
}

function scopeForType(input: QuoteInput): string[] {
  const base: string[] = [];
  if (input.style) base.push(`Style: ${input.style.replace(/-/g, " ")}`);
  if (input.projectType === "fence") {
    base.push(
      "Posts, rails, and panels per selected style",
      "Concrete or gravel post footings",
      ...(input.gates ? [`${input.gates} gate(s)`] : []),
      ...(input.corners ? [`${input.corners} corner(s)`] : [])
    );
  } else if (input.projectType === "deck") {
    base.push(
      `${input.material} decking and structural framing`,
      "Simpson Strong-Tie connectors",
      "Engineered footings (concrete or helical)"
    );
  } else if (input.projectType === "garage" || input.projectType === "shed") {
    base.push("Framed walls and pitched roof", "Tyvek wrap and sheathing", "Standard entry door");
  } else if (input.projectType === "pergola") {
    base.push("Timber posts and beams", "Rafter layout per style", "Concrete pier footings");
  } else if (input.projectType === "addition") {
    base.push("Framing package", "Roof tie-in", "Exterior wrap — finish scope per notes");
  }
  return [...base, ...input.upgrades].slice(0, 12);
}

function formatQuoteUserMessage(input: QuoteInput): string {
  const lines = [`Project type: ${input.projectType}`];
  if (input.projectType === "fence") {
    lines.push(
      `Fence run: ${input.dimensions.length} linear ft`,
      `Fence height: ${input.dimensions.width} ft`,
      ...(input.corners !== undefined ? [`Corners: ${input.corners}`] : []),
      ...(input.gates !== undefined ? [`Gates: ${input.gates}`] : [])
    );
  } else {
    lines.push(
      `Footprint: ${input.dimensions.length} ft × ${input.dimensions.width} ft (${
        input.dimensions.length * input.dimensions.width
      } sq ft)`
    );
  }
  if (input.style) lines.push(`Build style: ${input.style}`);
  lines.push(`Material preference: ${input.material}`);
  lines.push(`Upgrades: ${input.upgrades.length ? input.upgrades.join(", ") : "none selected"}`);
  if (input.location) lines.push(`Location: ${input.location}`);
  if (input.notes) lines.push("", "Client notes:", input.notes);
  if ((input.photos?.length ?? 0) > 0) {
    lines.push("", `${input.photos!.length} photo(s) attached — analyze them carefully.`);
  }
  lines.push("", "Produce a structured estimate matching the JSON schema exactly.");
  return lines.join("\n");
}
