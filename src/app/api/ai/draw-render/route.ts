/**
 * POST /api/ai/draw-render
 *
 * Body: DrawRenderInput (sketch and/or site photo, template, style, dimensions)
 * Returns: DrawRenderOutput + generatedMockupUrl (AI concept render)
 *
 * Two-step pipeline:
 *   1. Vision model interprets sketch + site photo + specs.
 *   2. Image model generates a photorealistic mockup in the client's space.
 */

import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { chatJSON, type ChatMessage, type ContentPart } from "@/lib/openrouter/client";
import { generateImage } from "@/lib/openrouter/generate-image";
import {
  DrawRenderInput,
  DrawRenderOutput,
  type DrawRenderOutput as DrawRenderOutputT,
} from "@/lib/openrouter/schemas";
import { DRAW_RENDER_PROMPT } from "@/lib/openrouter/prompts";
import {
  buildMockupPrompt,
  resolveStyle,
  type ProjectTemplate,
} from "@/lib/openrouter/project-styles";
import { checkRate } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

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
        clientMessage: "Sketch or site photo is missing or malformed.",
        message: parsed.error.message,
      });
    }
    const input = parsed.data;
    const template =
      input.template === "other" ? "deck" : (input.template as ProjectTemplate);
    const style = resolveStyle(template, input.style);

    const visionContent: ContentPart[] = [
      {
        type: "text",
        text: formatVisionUserMessage(input, style.label),
      },
    ];
    if (input.sitePhotoDataUrl) {
      visionContent.push({
        type: "image_url",
        image_url: { url: input.sitePhotoDataUrl, detail: "high" },
      });
    }
    if (input.sketchDataUrl) {
      visionContent.push({
        type: "image_url",
        image_url: { url: input.sketchDataUrl, detail: "high" },
      });
    }

    const messages: ChatMessage[] = [
      { role: "system", content: DRAW_RENDER_PROMPT },
      { role: "user", content: visionContent },
    ];

    let aiResult: DrawRenderOutputT;
    let visionFallback = false;
    try {
      aiResult = await chatJSON({
        task: "sketch",
        schema: DrawRenderOutput,
        schemaName: "DrawRenderOutput",
        messages,
        temperature: 0.3,
      });
    } catch (err) {
      console.warn(
        `[draw-render] Vision failed, using spec-only fallback: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      aiResult = deterministicInterpretation(input, style.label);
      visionFallback = true;
    }

    // Merge client-supplied dimensions over vision guesses when provided.
    if (input.dimensions?.lengthFt) {
      aiResult.approximateDimensions.length = input.dimensions.lengthFt;
    }
    if (input.dimensions?.widthFt) {
      aiResult.approximateDimensions.width = input.dimensions.widthFt;
    }

    const mockupPrompt = buildMockupPrompt({
      template,
      style,
      lengthFt: input.dimensions?.lengthFt ?? aiResult.approximateDimensions.length,
      widthFt: input.dimensions?.widthFt ?? aiResult.approximateDimensions.width,
      corners: input.dimensions?.corners,
      gates: input.dimensions?.gates,
      intent: input.intent,
      interpretation: aiResult.interpretation,
      detectedFeatures: aiResult.detectedFeatures,
      hasSitePhoto: Boolean(input.sitePhotoDataUrl),
      hasSketch: Boolean(input.sketchDataUrl),
    });

    const imageMessages: ChatMessage[] = [
      {
        role: "user",
        content: buildImageGenContent(mockupPrompt, input),
      },
    ];

    let generatedMockupUrl: string | null = null;
    let imageModel: string | undefined;
    let imageFallback = false;

    try {
      const img = await generateImage({
        task: "mockup",
        messages: imageMessages,
        aspectRatio: "16:9",
      });
      generatedMockupUrl = img.imageDataUrl;
      imageModel = img.model;
    } catch (err) {
      console.warn(
        `[draw-render] Image gen failed: ${err instanceof Error ? err.message : String(err)}`
      );
      imageFallback = true;
    }

    if (!generatedMockupUrl) {
      throw new AiError({
        code: "upstream_failed",
        status: 502,
        clientMessage:
          "We couldn't generate your mockup right now. Please try again in a moment — or call 250-910-9071.",
        message: "Image generation returned no result",
      });
    }

    return Response.json({
      ...aiResult,
      generatedMockupUrl,
      styleLabel: style.label,
      visionFallback,
      imageFallback,
      imageModel,
      isConceptRender: true,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

function formatVisionUserMessage(
  input: DrawRenderInput,
  styleLabel: string
): string {
  const lines = [
    `Template: ${input.template}`,
    `Selected style: ${styleLabel}`,
  ];
  const d = input.dimensions;
  if (d) {
    const parts: string[] = [];
    if (d.lengthFt) parts.push(`length/run: ${d.lengthFt} ft`);
    if (d.widthFt) parts.push(`width/depth: ${d.widthFt} ft`);
    if (d.corners !== undefined) parts.push(`corners: ${d.corners}`);
    if (d.gates !== undefined) parts.push(`gates: ${d.gates}`);
    if (parts.length) lines.push(`Client dimensions: ${parts.join(", ")}`);
  }
  if (input.intent) lines.push(`Client intent: ${input.intent}`);
  if (input.sitePhotoDataUrl) lines.push("Site photo attached — analyze the yard/space.");
  if (input.sketchDataUrl) lines.push("Client sketch attached — read the layout geometry.");
  lines.push("", "Analyze the attached image(s) and return STRICT JSON matching the schema.");
  return lines.join("\n");
}

function buildImageGenContent(
  prompt: string,
  input: DrawRenderInput
): ContentPart[] {
  const parts: ContentPart[] = [{ type: "text", text: prompt }];
  // Site photo first — primary reference for in-space compositing.
  if (input.sitePhotoDataUrl) {
    parts.push({
      type: "image_url",
      image_url: { url: input.sitePhotoDataUrl, detail: "high" },
    });
  }
  if (input.sketchDataUrl) {
    parts.push({
      type: "image_url",
      image_url: { url: input.sketchDataUrl, detail: "high" },
    });
  }
  return parts;
}

function deterministicInterpretation(
  input: DrawRenderInput,
  styleLabel: string
): DrawRenderOutputT {
  const d = input.dimensions;
  return {
    interpretation: `Concept mockup for a ${styleLabel} ${input.template} based on your specs and layout.`,
    detectedFeatures: [input.template, styleLabel],
    approximateDimensions: {
      length: d?.lengthFt ?? 0,
      width: d?.widthFt ?? 0,
      notes: d?.lengthFt ? "from client input" : "scale not visible",
    },
    designNotes:
      "AI vision was unavailable — mockup generated from your selected style and dimensions.",
    recommendedUpgrades: [],
  };
}
