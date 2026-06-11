/**
 * OpenRouter image generation — direct fetch, no SDK.
 *
 * Uses the chat/completions endpoint with `modalities: ["image", "text"]`.
 * Returns a base64 data URL from the assistant message `images` field.
 */

import { AiError } from "./errors";
import { FALLBACK_CHAIN, type ModelTask } from "./models";
import { logAiCall } from "../logger";
import type { ChatMessage } from "./client";

const OR_BASE = "https://openrouter.ai/api/v1";
const DEFAULT_TIMEOUT_MS = 90_000;
const MAX_USD_PER_REQUEST = Number(process.env.AI_MAX_USD_MOCKUP ?? "1.50");

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new AiError({
      code: "missing_api_key",
      status: 503,
      clientMessage:
        "The Black Timber AI tools are not configured yet. Please call 250-910-9071 to reach Jaryd directly.",
      message: "OPENROUTER_API_KEY is not set",
    });
  }
  return key;
}

interface ORImageResponse {
  model?: string;
  choices?: {
    message?: {
      content?: string;
      images?: { type?: string; image_url?: { url?: string } }[];
    };
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  total_cost?: number;
  error?: { message?: string };
}

export interface GenerateImageOptions {
  task?: ModelTask;
  messages: ChatMessage[];
  aspectRatio?: "16:9" | "4:3" | "3:2" | "1:1";
  maxUsd?: number;
  timeoutMs?: number;
}

export interface GenerateImageResult {
  imageDataUrl: string;
  model: string;
  caption?: string;
  costUSD: number;
}

export async function generateImage(opts: GenerateImageOptions): Promise<GenerateImageResult> {
  const task = opts.task ?? "mockup";
  const chain = FALLBACK_CHAIN[task];
  const startedAt = Date.now();
  let lastError: unknown;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  for (const model of chain) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      let res: Response;
      try {
        res = await fetch(`${OR_BASE}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getApiKey()}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
            "X-Title": process.env.OPENROUTER_SITE_NAME ?? "Black Timber Contracting",
          },
          body: JSON.stringify({
            model,
            messages: opts.messages,
            modalities: ["image", "text"],
            image_config: {
              aspect_ratio: opts.aspectRatio ?? "16:9",
              image_size: "1K",
            },
            usage: { include: true },
          }),
          signal: controller.signal,
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          throw new AiError({
            code: "upstream_timeout",
            status: 504,
            clientMessage: "Image generation took too long. Please try again.",
            message: `Image gen timeout after ${timeoutMs}ms on ${model}`,
          });
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }

      if (!res.ok) {
        const body = await safeReadText(res);
        lastError = new AiError({
          code: "upstream_failed",
          status: 502,
          clientMessage: "Image generation failed — trying a backup model.",
          message: `OpenRouter ${res.status} on ${model}: ${body.slice(0, 400)}`,
        });
        continue;
      }

      const data = (await res.json()) as ORImageResponse;
      if (data.error) {
        lastError = new AiError({
          code: "upstream_failed",
          status: 502,
          clientMessage: "Image generation returned an error.",
          message: data.error.message ?? "unknown",
        });
        continue;
      }

      const costUSD = data.total_cost ?? 0;
      const maxUsd = opts.maxUsd ?? MAX_USD_PER_REQUEST;
      if (costUSD > maxUsd) {
        console.warn(
          `[ai] mockup cost_cap_exceeded model=${model} cost=$${costUSD} cap=$${maxUsd}`
        );
      }

      const message = data.choices?.[0]?.message;
      const imageUrl = message?.images?.[0]?.image_url?.url;
      if (!imageUrl || !imageUrl.startsWith("data:image/")) {
        lastError = new AiError({
          code: "upstream_failed",
          status: 502,
          clientMessage: "No image was returned — trying a backup model.",
          message: `Empty images field from ${model}`,
        });
        continue;
      }

      logAiCall({
        task,
        model: data.model ?? model,
        schemaName: "GenerateImage",
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        costUSD,
        latencyMs: Date.now() - startedAt,
        ok: true,
      });

      return {
        imageDataUrl: imageUrl,
        model: data.model ?? model,
        caption: typeof message?.content === "string" ? message.content : undefined,
        costUSD,
      };
    } catch (err) {
      lastError = err;
    }
  }

  logAiCall({
    task,
    model: chain[chain.length - 1]!,
    schemaName: "GenerateImage",
    latencyMs: Date.now() - startedAt,
    ok: false,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });

  if (lastError instanceof AiError) throw lastError;
  throw new AiError({
    code: "upstream_failed",
    status: 502,
    clientMessage: "We couldn't generate your mockup right now. Please try again — or call 250-910-9071.",
    message: `All image models failed for task=${task}`,
    cause: lastError,
  });
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "<no body>";
  }
}
