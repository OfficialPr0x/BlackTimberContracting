/**
 * POST /api/ai/draw-render
 *
 * Body: { sketchDataUrl, template, intent? }
 * Returns: DrawRenderOutput + the matched portfolio photo URL
 *
 * Smart-match path (chosen over true AI image gen for honesty + cost reasons):
 *   1. Vision model interprets the sketch.
 *   2. Same model picks the closest real Black Timber portfolio photo by index.
 *   3. We map the index → real Cloudinary URL and return both.
 *
 * Result: customer sees "this is what we'd actually build that matches your
 * sketch" — real photo, real work, real trust. No hallucinated render to
 * disappoint them later.
 */

import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { chatJSON, type ChatMessage, type ContentPart } from "@/lib/openrouter/client";
import { DrawRenderInput, DrawRenderOutput, type DrawRenderOutput as DrawRenderOutputT } from "@/lib/openrouter/schemas";
import { DRAW_RENDER_PROMPT } from "@/lib/openrouter/prompts";
import { checkRate } from "@/lib/rate-limit";
import { JOB_PHOTOS, DRAW_RENDER_PHOTOS } from "@/data/jobPhotos";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    checkRate(req, "sketch");

    const json = await req.json().catch(() => null);
    if (!json) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Couldn't read your request body.",
      });
    }

    const parsed = DrawRenderInput.safeParse(json);
    if (!parsed.success) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Sketch data is missing or malformed.",
        message: parsed.error.message,
      });
    }
    const input = parsed.data;
    const portfolioSize = JOB_PHOTOS.length;

    const content: ContentPart[] = [
      {
        type: "text",
        text: [
          `Template: ${input.template}`,
          input.intent ? `Client intent: ${input.intent}` : null,
          `Portfolio has ${portfolioSize} photos (indices 0..${portfolioSize - 1}).`,
          "",
          "Analyze the sketch image below and return STRICT JSON matching the schema.",
        ]
          .filter(Boolean)
          .join("\n"),
      },
      { type: "image_url", image_url: { url: input.sketchDataUrl, detail: "high" } },
    ];

    const messages: ChatMessage[] = [
      { role: "system", content: DRAW_RENDER_PROMPT },
      { role: "user", content },
    ];

    let aiResult: DrawRenderOutputT;
    let usedFallback = false;
    try {
      aiResult = await chatJSON({
        task: "sketch",
        schema: DrawRenderOutput,
        schemaName: "DrawRenderOutput",
        messages,
        temperature: 0.3,
      });
    } catch (err) {
      // AI is unavailable / misconfigured / all models failed validation.
      // Customer should never see a red error — fall back to a deterministic
      // template-based portfolio match. Log loudly so we can tune.
      console.warn(
        `[draw-render] AI failed, returning deterministic fallback for template=${input.template}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      aiResult = deterministicFallback(input.template);
      usedFallback = true;
    }

    // Clamp the portfolio index into a safe range (model might overshoot).
    const clampedIdx = Math.min(
      Math.max(0, Math.floor(aiResult.bestPortfolioMatchIndex)),
      Math.max(0, portfolioSize - 1)
    );

    return Response.json({
      ...aiResult,
      bestPortfolioMatchIndex: clampedIdx,
      bestPortfolioMatchUrl: JOB_PHOTOS[clampedIdx],
      usedFallback,
    });
  } catch (err) {
    // Only validation / rate-limit errors reach here — those SHOULD be visible.
    return errorResponse(err);
  }
}

/**
 * Deterministic fallback when AI is unavailable. Picks a real portfolio photo
 * matched to the template and returns honest copy that doesn't pretend to be
 * AI-generated. Customer still gets a useful UI; no red error banner.
 */
function deterministicFallback(template: DrawRenderInput["template"]): DrawRenderOutputT {
  const templateMap: Record<DrawRenderInput["template"], number> = {
    deck: 0,
    fence: 1,
    garage: 2,
    pergola: 3,
    other: 0,
  };
  const fallbackUrl = DRAW_RENDER_PHOTOS[templateMap[template]] ?? JOB_PHOTOS[0];
  // Resolve the URL back to an index in the master JOB_PHOTOS list.
  const idx = Math.max(0, JOB_PHOTOS.indexOf(fallbackUrl));

  const copy: Record<DrawRenderInput["template"], { interp: string; reason: string; feats: string[]; upgrades: string[] }> = {
    deck: {
      interp: "We couldn't read your sketch in full detail right now — here's a recent Black Timber deck build that hits similar geometry to use as inspiration.",
      reason: "Pulled from the portfolio as a close match by template type.",
      feats: ["timber posts", "deck surface", "stairs"],
      upgrades: ["LED post-cap lighting", "black aluminum railing", "cedar skirting"],
    },
    fence: {
      interp: "We couldn't read your sketch in full detail right now — here's a Black Timber fence build that fits the template you picked.",
      reason: "Pulled from the portfolio as a close match by template type.",
      feats: ["fence panels", "top rail", "posts"],
      upgrades: ["lattice top", "stained finish", "gate hardware upgrade"],
    },
    garage: {
      interp: "We couldn't read your sketch in full detail right now — here's a Black Timber garage / outbuilding build matching the template.",
      reason: "Pulled from the portfolio as a close match by template type.",
      feats: ["framed walls", "pitched roof", "garage door"],
      upgrades: ["insulated overhead door", "side entry door", "metal roofing"],
    },
    pergola: {
      interp: "We couldn't read your sketch in full detail right now — here's a Black Timber pergola build matching the template.",
      reason: "Pulled from the portfolio as a close match by template type.",
      feats: ["timber posts", "main beam", "cross rafters"],
      upgrades: ["louvered top", "integrated lighting", "privacy panel"],
    },
    other: {
      interp: "We couldn't read your sketch in full detail right now — here's a recent Black Timber build as a reference.",
      reason: "Pulled from the portfolio.",
      feats: ["custom structure"],
      upgrades: [],
    },
  };
  const c = copy[template];
  return {
    interpretation: c.interp,
    detectedFeatures: c.feats,
    approximateDimensions: { length: 0, width: 0, notes: "scale not visible" },
    bestPortfolioMatchIndex: idx,
    matchReason: c.reason,
    recommendedUpgrades: c.upgrades,
  };
}
