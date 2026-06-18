import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { chatJSON, type ChatMessage, type ContentPart } from "@/lib/openrouter/client";
import { geminiGenerate, isGeminiConfigured } from "@/lib/gemini/client";
import { getSiteOrigin } from "@/lib/esign/site-url";
import { HERO_PHOTOS, DRAW_RENDER_PHOTOS, JOB_PHOTO_COUNT } from "@/data/jobPhotos";
import { z } from "zod";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let cachedBrief: { text: string; at: number } | null = null;

const PortfolioBriefSchema = z.object({
  capabilitiesMarkdown: z.string().min(100).max(8000),
});

const VISION_PROMPT = `You are analyzing Black Timber Contracting's REAL job photo portfolio.
Describe what the company demonstrably builds (materials, scale, quality tier) so a B2B prospecting agent can match us to developers/GCs in the Kootenays.

Output JSON: { "capabilitiesMarkdown": "..." }

Include sections:
- Core trades we prove in photos (decks, pergolas, exterior, etc.)
- Quality signals (craftsmanship, mountain/modern aesthetic)
- Project scale (residential, custom, high-end)
- Best-fit partner types (who should sub us vs hire us direct)
- What we are NOT (e.g. commercial high-rise, excavation-only)

Be factual — only describe what you see.`;

export const FALLBACK_BRIEF = `
Black Timber Contracting (Cranbrook BC, East Kootenay) — custom residential exterior builds:
multi-level decks, pergolas, garages, additions, roofing, siding, flooring, interior finishing.
High-end mountain-modern aesthetic; Fernie Home Hardware supply relationships; helical piles / snow load aware.
Ideal B2B partners: local developers, design-build firms, and GCs needing reliable finish carpentry / exterior subs.
`.trim();

async function loadImageAsBase64(relativePath: string): Promise<{
  mimeType: string;
  data: string;
} | null> {
  try {
    const abs = path.join(process.cwd(), "public", relativePath.replace(/^\//, ""));
    const buf = await readFile(abs);
    return { mimeType: "image/jpeg", data: buf.toString("base64") };
  } catch {
    return null;
  }
}

function visionSamplePaths(max = 10): string[] {
  const picks = new Set<string>();
  for (const p of [...HERO_PHOTOS, ...DRAW_RENDER_PHOTOS]) picks.add(p);
  for (let i = 0; i < 6; i++) {
    picks.add(`/jobs/job-${String(10 + i * 11).padStart(2, "0")}.jpg`);
  }
  return [...picks].slice(0, max);
}

async function briefViaGeminiApi(maxImages = 10): Promise<string> {
  const images: Array<{ mimeType: string; data: string }> = [];
  for (const rel of visionSamplePaths(maxImages)) {
    const img = await loadImageAsBase64(rel);
    if (img) images.push(img);
  }

  const text = await geminiGenerate({
    systemInstruction: `${VISION_PROMPT}\n\nRespond with markdown only (no JSON wrapper).`,
    userText: `Analyze these ${images.length} portfolio photos (${JOB_PHOTO_COUNT} total in gallery).`,
    imageBase64: images,
    temperature: 0.15,
  });

  return text;
}

async function briefViaOpenRouter(opts?: {
  maxImages?: number;
  timeoutMs?: number;
  fast?: boolean;
}): Promise<string> {
  const origin = getSiteOrigin();
  const maxImages = opts?.maxImages ?? 10;
  const parts: ContentPart[] = [
    {
      type: "text",
      text: `Analyze our portfolio (${JOB_PHOTO_COUNT} job photos total). Return JSON with capabilitiesMarkdown.`,
    },
  ];

  for (const rel of visionSamplePaths(maxImages)) {
    parts.push({
      type: "image_url",
      image_url: { url: `${origin}${rel}`, detail: "low" },
    });
  }

  const messages: ChatMessage[] = [
    { role: "system", content: VISION_PROMPT },
    { role: "user", content: parts },
  ];

  const result = await chatJSON({
    // Fast path: Gemini Flash (parse chain). Full path: prospect chain for richer analysis.
    task: opts?.fast ? "parse" : "prospect",
    schema: PortfolioBriefSchema,
    schemaName: "PortfolioBrief",
    messages,
    temperature: 0.15,
    jsonObject: true,
    timeoutMs: opts?.timeoutMs ?? 45_000,
    maxModels: opts?.fast ? 1 : 2,
  });

  return result.capabilitiesMarkdown;
}

async function generateBrief(opts?: { maxWaitMs?: number }): Promise<string> {
  const fast = !!opts?.maxWaitMs;
  if (isGeminiConfigured()) {
    return briefViaGeminiApi(fast ? 4 : 10);
  }
  return briefViaOpenRouter({
    maxImages: fast ? 4 : 10,
    timeoutMs: fast ? 18_000 : 45_000,
    fast,
  });
}

export interface PortfolioBriefOptions {
  /**
   * When set, skip slow vision on cache miss after this many ms and use FALLBACK_BRIEF.
   * Keeps prospect search under Vercel's serverless timeout.
   */
  maxWaitMs?: number;
}

/** Cached vision-derived portfolio brief for prospect matching. */
export async function getPortfolioBrief(opts?: PortfolioBriefOptions): Promise<string> {
  if (cachedBrief && Date.now() - cachedBrief.at < CACHE_TTL_MS) {
    return cachedBrief.text;
  }

  if (opts?.maxWaitMs) {
    try {
      const text = await Promise.race([
        generateBrief({ maxWaitMs: opts.maxWaitMs }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("portfolio-brief timeout")), opts.maxWaitMs)
        ),
      ]);
      cachedBrief = { text, at: Date.now() };
      return text;
    } catch (err) {
      console.warn("[portfolio-brief] fast fallback", err);
      return FALLBACK_BRIEF;
    }
  }

  let text: string;
  try {
    text = await generateBrief();
  } catch (err) {
    console.error("[portfolio-brief]", err);
    text = FALLBACK_BRIEF;
  }

  cachedBrief = { text, at: Date.now() };
  return text;
}
