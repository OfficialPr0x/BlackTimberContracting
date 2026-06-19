/**
 * OpenRouter client — direct fetch, no SDK.
 *
 * Why direct fetch?
 *   - OpenRouter is OpenAI chat-completions-compatible. The wire format is
 *     boring and stable. An SDK would add a moving dependency (and React 19 /
 *     Next 16 compat headaches) for zero functional gain.
 *   - We get full control over: timeouts, retries, fallback chains, streaming,
 *     cost capping, structured logging — all the stuff you actually want in
 *     production.
 *
 * Public surface (use ONLY these from routes):
 *   - chatJSON()       structured-output call, validates against zod schema
 *   - chatStream()     SSE streaming chat, yields token chunks
 *   - cachedChatJSON() in-memory LRU cache for idempotent calls
 *
 * Everything else is internal.
 */

import { z } from "zod";
import { AiError } from "./errors";
import { FALLBACK_CHAIN, MODELS, type ModelTask } from "./models";
import { logAiCall } from "../logger";

// JSON-schema cache: building from zod is cheap but not free; cache by name.
const SCHEMA_CACHE = new Map<string, Record<string, unknown>>();

/**
 * Convert a Zod schema to a provider-friendly JSON Schema.
 *
 * We use zod v4's built-in `z.toJSONSchema()` (works with our zod ^4.x) and
 * then sanitize the output for OpenRouter's strict structured-output mode:
 *
 * - Drop `$schema` declarations (Gemini rejects them as "undefined reference
 *   at top-level"). OpenAI, Anthropic, and Mistral all tolerate this.
 * - Inline any `$defs` references so providers don't need to resolve refs.
 * - Force `additionalProperties: false` on every object (already produced by
 *   zod v4 but we belt-and-suspenders it in case of partials/extensions).
 */
function getJsonSchema(schemaName: string, zSchema: z.ZodType): Record<string, unknown> {
  const cached = SCHEMA_CACHE.get(schemaName);
  if (cached) return cached;
  let cleaned: Record<string, unknown>;
  try {
    const raw = z.toJSONSchema(zSchema, { target: "draft-2020-12" }) as Record<string, unknown>;
    cleaned = sanitizeForProviders(raw);
  } catch {
    // Lenient schemas (preprocess/transform for self-healing parsing) can't
    // always be expressed as JSON Schema. That's fine: such calls use
    // `jsonObject` mode where this schema is never sent — Zod still validates
    // the response. Fall back to a permissive object so we never abort here.
    cleaned = { type: "object", additionalProperties: true };
  }
  SCHEMA_CACHE.set(schemaName, cleaned);
  return cleaned;
}

function sanitizeForProviders(input: unknown): Record<string, unknown> {
  // Inline $defs recursively, then strip $schema/$defs at every level.
  const defs = isObj(input) && isObj(input.$defs) ? (input.$defs as Record<string, unknown>) : {};

  function walk(node: unknown): unknown {
    if (Array.isArray(node)) return node.map(walk);
    if (!isObj(node)) return node;
    // Resolve $ref → defs[name] (we only handle "#/$defs/Name" form).
    if (typeof node.$ref === "string") {
      const m = /^#\/\$defs\/(.+)$/.exec(node.$ref);
      if (m && defs[m[1]]) return walk(defs[m[1]]);
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "$schema" || k === "$defs" || k === "$id") continue;
      out[k] = walk(v);
    }
    if (out.type === "object" && !("additionalProperties" in out)) {
      out.additionalProperties = false;
    }
    return out;
  }
  return walk(input) as Record<string, unknown>;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const OR_BASE = "https://openrouter.ai/api/v1";
const DEFAULT_TIMEOUT_MS = 60_000;            // 60s — vision calls can be slow
const STREAM_TIMEOUT_MS = 90_000;             // 90s — streaming can take longer
const MAX_USD_PER_REQUEST = Number(process.env.AI_MAX_USD_PER_REQUEST ?? "0.50");

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

function buildHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
    // OpenRouter uses these for attribution + per-app analytics on your dashboard.
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
    "X-Title": process.env.OPENROUTER_SITE_NAME ?? "Black Timber Contracting",
  };
}

// -----------------------------------------------------------------------------
// Wire types (subset we care about)
// -----------------------------------------------------------------------------

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

interface ORResponse {
  id?: string;
  model?: string;
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  // OpenRouter returns USD spend per call when available.
  // Source: https://openrouter.ai/docs/use-cases/usage-accounting
  total_cost?: number;
  error?: { code?: string; message?: string };
}

// -----------------------------------------------------------------------------
// Internal: single HTTP call with timeout
// -----------------------------------------------------------------------------

async function callOnce(
  model: string,
  body: Record<string, unknown>,
  timeoutMs: number,
  stream: boolean
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // buildHeaders() can throw AiError(missing_api_key) synchronously — we
    // must NOT wrap that in a generic upstream_failed error below, or the
    // operator loses the useful "set OPENROUTER_API_KEY" message.
    const headers = buildHeaders();
    const res = await fetch(`${OR_BASE}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, model, stream }),
      signal: controller.signal,
    });
    return res;
  } catch (err) {
    // Preserve typed AiErrors as-is (missing_api_key, etc).
    if (err instanceof AiError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new AiError({
        code: "upstream_timeout",
        status: 504,
        clientMessage: "The AI took too long to respond. Please try again — or call 250-910-9071.",
        message: `OpenRouter timeout after ${timeoutMs}ms on model ${model}`,
      });
    }
    throw new AiError({
      code: "upstream_failed",
      status: 502,
      clientMessage: "We couldn't reach the AI right now. Please try again in a moment.",
      message: `OpenRouter fetch failed for model ${model}: ${(err as Error).message}`,
      cause: err,
    });
  } finally {
    clearTimeout(timeout);
  }
}

// -----------------------------------------------------------------------------
// Public: structured JSON call with fallback chain + schema validation
// -----------------------------------------------------------------------------

interface ChatJSONOptions<T> {
  task: ModelTask;
  schema: z.ZodType<T>;
  /** Human name for logs, e.g. "QuoteOutput". */
  schemaName: string;
  messages: ChatMessage[];
  /** 0.0–2.0. Default 0.2 for structured tasks. */
  temperature?: number;
  /** Force fresh, no cache. Default false. */
  noCache?: boolean;
  /** Override per-request cost cap. */
  maxUsd?: number;
  /** Per-model HTTP timeout. Default 60s; parse uses ~22s so fallbacks fit in Vercel. */
  timeoutMs?: number;
  /**
   * OpenRouter json_schema strict mode. Default true. Use false for partial
   * schemas (Cmd+K parse) — strict mode often 400s on GPT-5 with many optionals.
   */
  strict?: boolean;
  /**
   * Use `{ type: "json_object" }` instead of json_schema. Far more reliable
   * across providers (Gemini Flash, Haiku). Zod still validates the response.
   * Pair with `jsonSchemaHint` in the user message.
   */
  jsonObject?: boolean;
  /** Cap how many models in the fallback chain to try. Default: entire chain. */
  maxModels?: number;
  /** Max output tokens. Raise for large JSON arrays to avoid truncation. */
  maxTokens?: number;
  /** Pass-through provider routing if you need OpenAI/Anthropic-specific options. */
  extraBody?: Record<string, unknown>;
}

export async function chatJSON<T>(opts: ChatJSONOptions<T>): Promise<T> {
  const chain = FALLBACK_CHAIN[opts.task].slice(0, opts.maxModels ?? FALLBACK_CHAIN[opts.task].length);
  const startedAt = Date.now();
  let lastError: unknown;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const strict = opts.strict ?? true;
  const useJsonObject = opts.jsonObject ?? false;

  // Build the JSON Schema once and reuse across retries / fallbacks.
  const jsonSchema = getJsonSchema(opts.schemaName, opts.schema as z.ZodType);

  const responseFormat: Record<string, unknown> = useJsonObject
    ? { type: "json_object" }
    : {
        type: "json_schema",
        json_schema: { name: opts.schemaName, strict, schema: jsonSchema },
      };

  for (const model of chain) {
    try {
      const res = await callOnce(
        model,
        {
          messages: opts.messages,
          temperature: opts.temperature ?? 0.2,
          response_format: responseFormat,
          ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
          // OpenRouter usage accounting (cost in USD) — opt-in per request.
          usage: { include: true },
          ...opts.extraBody,
        },
        timeoutMs,
        false
      );

      if (!res.ok) {
        const body = await safeReadText(res);
        const isLast = model === chain[chain.length - 1];
        lastError = new AiError({
          code: "upstream_failed",
          status: 502,
          clientMessage: isLast
            ? `AI failed on all models. Check OPENROUTER_API_KEY in Vercel. (${res.status})`
            : "AI request failed — trying a backup model.",
          message: `OpenRouter ${res.status} on ${model}: ${body.slice(0, 400)}`,
        });
        continue;
      }

      const data = (await res.json()) as ORResponse;
      if (data.error) {
        lastError = new AiError({
          code: "upstream_failed",
          status: 502,
          clientMessage: "AI returned an error.",
          message: `OpenRouter error on ${model}: ${data.error.message ?? "unknown"}`,
        });
        continue;
      }

      const costUSD = data.total_cost ?? 0;
      const maxUsd = opts.maxUsd ?? MAX_USD_PER_REQUEST;
      if (costUSD > maxUsd) {
        // We've already PAID for this call — but flag it loudly so we can tune.
        console.warn(
          `[ai] cost_cap_exceeded task=${opts.task} model=${model} cost=$${costUSD} cap=$${maxUsd}`
        );
      }

      const raw = data.choices?.[0]?.message?.content;
      if (!raw || typeof raw !== "string") {
        lastError = new AiError({
          code: "schema_violation",
          status: 502,
          clientMessage: "AI returned an empty response.",
          message: `Empty content from ${model}`,
        });
        continue;
      }

      const parsed = extractJSON(raw);
      const validated = opts.schema.safeParse(parsed);
      if (!validated.success) {
        lastError = new AiError({
          code: "schema_violation",
          status: 502,
          clientMessage: "AI response didn't match the expected shape — trying a backup model.",
          message: `${opts.schemaName} validation failed on ${model}: ${validated.error.message.slice(0, 400)}`,
        });
        continue;
      }

      logAiCall({
        task: opts.task,
        model: data.model ?? model,
        schemaName: opts.schemaName,
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        costUSD,
        latencyMs: Date.now() - startedAt,
        ok: true,
      });

      return validated.data;
    } catch (err) {
      lastError = err;
      // Continue to next model in the chain
    }
  }

  logAiCall({
    task: opts.task,
    model: chain[chain.length - 1],
    schemaName: opts.schemaName,
    latencyMs: Date.now() - startedAt,
    ok: false,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });

  if (lastError instanceof AiError) throw lastError;
  throw new AiError({
    code: "upstream_failed",
    status: 502,
    clientMessage: "Our AI is having a moment. Please try again — or call 250-910-9071.",
    message: `All models in chain failed for task=${opts.task}`,
    cause: lastError,
  });
}

// -----------------------------------------------------------------------------
// Public: SSE streaming chat for the concierge
// -----------------------------------------------------------------------------

interface ChatStreamOptions {
  task: ModelTask;
  messages: ChatMessage[];
  temperature?: number;
}

/**
 * Returns a ReadableStream<Uint8Array> of UTF-8 text chunks. Caller pipes
 * straight into a `Response` body. No SSE re-framing — callers can wrap if
 * they need EventSource semantics.
 */
export async function chatStream(opts: ChatStreamOptions): Promise<ReadableStream<Uint8Array>> {
  const chain = FALLBACK_CHAIN[opts.task];
  let lastError: unknown;

  for (const model of chain) {
    try {
      const res = await callOnce(
        model,
        { messages: opts.messages, temperature: opts.temperature ?? 0.7 },
        STREAM_TIMEOUT_MS,
        true
      );

      if (!res.ok || !res.body) {
        const body = await safeReadText(res);
        lastError = new AiError({
          code: "upstream_failed",
          status: 502,
          clientMessage: "Streaming AI request failed — trying a backup model.",
          message: `Stream ${res.status} on ${model}: ${body.slice(0, 200)}`,
        });
        continue;
      }

      return parseSSEToTextStream(res.body);
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError instanceof AiError) throw lastError;
  throw new AiError({
    code: "upstream_failed",
    status: 502,
    clientMessage: "Chat is unavailable right now. Please try again in a moment.",
    message: "All streaming models failed",
    cause: lastError,
  });
}

// -----------------------------------------------------------------------------
// Public: cached JSON call (for ProjectCheck-style "same address → same brief")
// -----------------------------------------------------------------------------

interface CacheEntry { at: number; value: unknown }
const CACHE = new Map<string, CacheEntry>();
const CACHE_MAX = 200;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min — site intel doesn't change hourly

export async function cachedChatJSON<T>(
  cacheKey: string,
  opts: ChatJSONOptions<T>
): Promise<T> {
  const now = Date.now();
  const hit = CACHE.get(cacheKey);
  if (hit && now - hit.at < CACHE_TTL_MS) {
    return hit.value as T;
  }
  const value = await chatJSON(opts);
  CACHE.set(cacheKey, { at: now, value });
  // Cheap LRU-ish eviction — drop oldest when over cap.
  if (CACHE.size > CACHE_MAX) {
    const firstKey = CACHE.keys().next().value;
    if (firstKey !== undefined) CACHE.delete(firstKey);
  }
  return value;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Extract the JSON object from a model response, tolerating markdown fences. */
function extractJSON(raw: string): unknown {
  const trimmed = raw.trim();
  // Strip ```json ... ``` or ``` ... ``` fences if the model added them.
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  let body = fenceMatch ? fenceMatch[1] : trimmed;

  // Some models prepend prose before the JSON. Slice from the first { or [ to
  // the last matching } or ] so leading/trailing chatter doesn't break parsing.
  const firstObj = body.indexOf("{");
  const firstArr = body.indexOf("[");
  const start =
    firstObj === -1 ? firstArr : firstArr === -1 ? firstObj : Math.min(firstObj, firstArr);
  if (start > 0) body = body.slice(start);

  // Fast path.
  try {
    return JSON.parse(body);
  } catch {
    /* fall through to repair */
  }

  // Repair path: providers (esp. fast models) sometimes truncate long arrays.
  // Close any open string + balance brackets so we can salvage the prefix.
  const repaired = repairTruncatedJson(body);
  if (repaired) {
    try {
      return JSON.parse(repaired);
    } catch {
      /* fall through to error */
    }
  }

  throw new AiError({
    code: "schema_violation",
    status: 502,
    clientMessage: "AI returned malformed JSON.",
    message: `JSON.parse failed even after repair. Raw (first 300): ${body.slice(0, 300)}`,
  });
}

/**
 * Best-effort repair of a truncated JSON document: walks the string tracking
 * depth + string state, drops a trailing partial token, then appends the
 * closing quotes/brackets needed to make it parseable. Returns null if it can't
 * find a sane truncation point.
 */
function repairTruncatedJson(input: string): string | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let lastSafe = -1; // index just after the last complete value (`}` `]` `"` or digit)

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') {
        inString = false;
        lastSafe = i + 1;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{" || ch === "[") {
      stack.push(ch);
    } else if (ch === "}" || ch === "]") {
      stack.pop();
      lastSafe = i + 1;
    } else if (ch === "," ) {
      lastSafe = i; // can cut the dangling element before a comma
    } else if (/[0-9truefalsn.eE+-]/.test(ch)) {
      lastSafe = i + 1;
    }
  }

  if (lastSafe <= 0) return null;

  // Cut at the last complete value, dropping any partial trailing element + comma.
  let out = input.slice(0, lastSafe).replace(/,\s*$/, "");

  // Re-balance using a fresh scan of the truncated output.
  const closers: string[] = [];
  let s = false;
  let esc = false;
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    if (s) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') s = false;
      continue;
    }
    if (ch === '"') s = true;
    else if (ch === "{") closers.push("}");
    else if (ch === "[") closers.push("]");
    else if (ch === "}" || ch === "]") closers.pop();
  }
  if (s) out += '"'; // close an unterminated string
  while (closers.length) out += closers.pop();

  return out;
}

async function safeReadText(res: Response): Promise<string> {
  try { return await res.text(); } catch { return "<no body>"; }
}

/**
 * Convert OpenRouter SSE chunks into a plain UTF-8 text stream.
 *
 * We use `start()` (eager push) instead of `pull()` (lazy backpressure) so
 * tokens are forwarded the instant they arrive — `pull()` waits for the
 * consumer to ask for the next chunk, which compounds latency on every
 * token, making short replies feel "stuck" before they catch up.
 *
 * The first chunk we send is a single space — a "stream primer" that flushes
 * the response through any intermediate proxy buffer in Next dev / Vercel /
 * nginx so the browser starts reading immediately. We trim it on the client.
 */
function parseSSEToTextStream(input: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      // Prime the connection so proxies flush the headers immediately.
      controller.enqueue(encoder.encode(" "));

      const reader = input.getReader();
      let buf = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          buf += decoder.decode(value, { stream: true });

          // Split on SSE record boundary (blank line).
          const records = buf.split("\n\n");
          buf = records.pop() ?? "";

          for (const record of records) {
            for (const line of record.split("\n")) {
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (payload === "" || payload === "[DONE]") {
                if (payload === "[DONE]") {
                  controller.close();
                  return;
                }
                continue;
              }
              try {
                const json = JSON.parse(payload) as {
                  choices?: { delta?: { content?: string } }[];
                };
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) controller.enqueue(encoder.encode(delta));
              } catch {
                // ignore — partial / keep-alive frames
              }
            }
          }
        }
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
