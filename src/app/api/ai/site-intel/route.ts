/**
 * POST /api/ai/site-intel
 *
 * Body: { address: string }
 * Returns: SiteIntelOutput
 *
 * Uses a web-grounded model (Perplexity Sonar by default) so the snow loads,
 * permit authorities, and elevation values aren't hallucinated from training
 * data. Cached for 30 minutes per address — site intel doesn't change hourly.
 */

import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { cachedChatJSON, type ChatMessage } from "@/lib/openrouter/client";
import {
  SiteIntelInput,
  SiteIntelOutput,
  type SiteIntelOutput as SiteIntelOutputT,
} from "@/lib/openrouter/schemas";
import { SITE_INTEL_PROMPT } from "@/lib/openrouter/prompts";
import { checkRate } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    checkRate(req, "intel");

    const json = await req.json().catch(() => null);
    if (!json) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Couldn't read your request body.",
      });
    }

    const parsed = SiteIntelInput.safeParse(json);
    if (!parsed.success) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Please enter a valid property address.",
        message: parsed.error.message,
      });
    }

    const { address } = parsed.data;
    const cacheKey = address.toLowerCase().replace(/\s+/g, " ").trim();

    const messages: ChatMessage[] = [
      { role: "system", content: SITE_INTEL_PROMPT },
      {
        role: "user",
        content: `Address to analyze: ${address}\n\nProduce a complete site intelligence brief matching the JSON schema. Use web search to ground every numeric value (snow load, frost line, elevation, permit authority). If something can't be verified, set confidence: "low" and note the gap in the sources array.`,
      },
    ];

    let result: SiteIntelOutputT;
    let usedFallback = false;
    try {
      result = await cachedChatJSON(`intel:${cacheKey}`, {
        task: "intel",
        schema: SiteIntelOutput,
        schemaName: "SiteIntelOutput",
        messages,
        temperature: 0.1,
      });
    } catch (err) {
      console.warn(
        `[site-intel] AI failed, returning Kootenay default profile: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      result = kootenayDefault(address);
      usedFallback = true;
    }

    return Response.json({ ...result, usedFallback });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Deterministic fallback — assumes a generic East Kootenay site. Confidence
 * is "low" so the UI shows the yellow badge, prompting the customer to call
 * Jaryd for real numbers.
 */
function kootenayDefault(address: string): SiteIntelOutputT {
  return {
    resolvedLocation: address,
    region: "East Kootenay region (assumed)",
    terrain: { slopePercent: 5, slopeDifficulty: "moderate", elevationMeters: 900 },
    climate: {
      snowLoadKPa: 4.8,
      snowLoadCategory: "heavy",
      frostLineInches: 48,
      sunHoursPerDay: 7,
      windCategory: "moderate",
    },
    permitting: {
      authority: "Regional District of East Kootenay (assumed)",
      typicalRequirements:
        "Residential deck / structure permit; engineer's stamp typically required for snow loads above 5 kPa.",
      needsEngineerStamp: false,
    },
    suggestedMaterials: [
      "Western Red Cedar planks",
      "Helical pile foundations to 48\" depth",
      "Simpson Strong-Tie hardware",
      "Black aluminum railings",
    ],
    styleInspirations: [
      { city: "Cranbrook", style: "Multi-level mountain modern" },
      { city: "Fernie", style: "Alpine timber-and-steel" },
    ],
    confidence: "low",
    sources: [],
  };
}
