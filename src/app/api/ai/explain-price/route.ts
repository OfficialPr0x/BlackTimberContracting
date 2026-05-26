/**
 * POST /api/ai/explain-price
 *
 * Body: ExplainPriceInput (calculator config + deterministic range)
 * Returns: ExplainPriceOutput (narrative + sanity-checked range + callouts)
 *
 * Called from the "Have Black Timber's AI sanity-check this" button on the
 * cost calculator. The sliders stay instant (deterministic JS); this endpoint
 * provides the human voice + a check on the math.
 */

import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { chatJSON, type ChatMessage } from "@/lib/openrouter/client";
import {
  ExplainPriceInput,
  ExplainPriceOutput,
  type ExplainPriceOutput as ExplainPriceOutputT,
} from "@/lib/openrouter/schemas";
import { EXPLAIN_PRICE_PROMPT } from "@/lib/openrouter/prompts";
import { checkRate } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(req: Request) {
  try {
    checkRate(req, "explain");

    const json = await req.json().catch(() => null);
    if (!json) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Couldn't read your request body.",
      });
    }

    const parsed = ExplainPriceInput.safeParse(json);
    if (!parsed.success) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Some fields are missing or invalid.",
        message: parsed.error.message,
      });
    }
    const input = parsed.data;

    const activeUpgrades = Object.entries(input.upgrades)
      .filter(([, on]) => on)
      .map(([k]) => k);

    const userMessage = [
      `Deck config:`,
      `  - Size: ${input.length} ft × ${input.width} ft (${input.length * input.width} sq ft)`,
      `  - Material: ${input.material}`,
      `  - Active upgrades: ${activeUpgrades.length ? activeUpgrades.join(", ") : "none"}`,
      ``,
      `Our deterministic calculator returned: $${input.deterministicRangeUSD.min.toLocaleString()}–$${input.deterministicRangeUSD.max.toLocaleString()}`,
      ``,
      `Explain, sanity-check, and describe what this build will feel like. Return STRICT JSON per schema.`,
    ].join("\n");

    const messages: ChatMessage[] = [
      { role: "system", content: EXPLAIN_PRICE_PROMPT },
      { role: "user", content: userMessage },
    ];

    let result: ExplainPriceOutputT;
    let usedFallback = false;
    try {
      result = await chatJSON({
        task: "explain",
        schema: ExplainPriceOutput,
        schemaName: "ExplainPriceOutput",
        messages,
        temperature: 0.4,
      });
    } catch (err) {
      console.warn(
        `[explain-price] AI failed, returning deterministic narrative: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      result = deterministicExplain(input, activeUpgrades);
      usedFallback = true;
    }

    // Sanity guard + tuning signal: warn if AI disagrees with our math by >25%.
    const detMid = (input.deterministicRangeUSD.min + input.deterministicRangeUSD.max) / 2;
    const aiMid = (result.adjustedRangeUSD.min + result.adjustedRangeUSD.max) / 2;
    if (detMid > 0) {
      const delta = Math.abs(aiMid - detMid) / detMid;
      if (delta > 0.25) {
        console.warn(
          `[explain-price] AI disagrees with deterministic math by ${(delta * 100).toFixed(0)}% ` +
            `(det $${detMid.toFixed(0)} vs AI $${aiMid.toFixed(0)}). Consider tuning calculator coefficients.`
        );
      }
    }

    return Response.json({ ...result, usedFallback });
  } catch (err) {
    return errorResponse(err);
  }
}

function deterministicExplain(input: ExplainPriceInput, activeUpgrades: string[]): ExplainPriceOutputT {
  const area = input.length * input.width;
  const matLabel =
    input.material === "cedar"
      ? "Western Red Cedar"
      : input.material === "composite"
      ? "TimberTech composite"
      : "pressure-treated structural wood";
  return {
    narrative: `For a ${input.length}×${input.width} ft (${area} sq ft) ${matLabel} build with ${activeUpgrades.length} active upgrade${activeUpgrades.length === 1 ? "" : "s"}, this range covers the timber + hardware, the labor to install it cleanly, and the permit fees to keep it on the right side of the inspector. The upper end accounts for slope adjustments and access factors we won't know precisely until a site visit.`,
    adjustedRangeUSD: input.deterministicRangeUSD,
    experienceNote: `When this is done you'll get the smell of ${matLabel} on warm mornings, zero wobble underfoot, and a structure rated for our regional snow load.`,
    callouts: [
      `${area} sq ft footprint`,
      activeUpgrades.length > 0 ? `Upgrades: ${activeUpgrades.join(", ")}` : "No upgrades selected — base build",
      "Permit + engineer's stamp handled by Black Timber",
    ],
  };
}
