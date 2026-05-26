/**
 * Best-of-class model routing per task, as of mid-2026.
 *
 * Every entry can be overridden by environment variable so we can swap models
 * without a redeploy — production hygiene. Browse current catalog + per-token
 * pricing at https://openrouter.ai/models
 *
 * The model IDs below use OpenRouter's "vendor/model" namespacing. If OpenRouter
 * deprecates one, the fallback chain (see client.ts) catches it.
 */

export type ModelTask =
  | "quote"      // structured estimate from project specs + photos (vision needed)
  | "intel"      // address → grounded site brief (web access needed)
  | "sketch"     // canvas PNG → interpret what the client drew (vision needed)
  | "explain"    // narrate the cost-calculator math, sanity-check the range
  | "chat"       // streaming concierge chat
  | "fallback";  // last-ditch cheap/fast model when primaries 5xx

export const MODELS: Record<ModelTask, string> = {
  quote:    process.env.OPENROUTER_MODEL_QUOTE    ?? "anthropic/claude-sonnet-4.5",
  intel:    process.env.OPENROUTER_MODEL_INTEL    ?? "perplexity/sonar-reasoning-pro",
  sketch:   process.env.OPENROUTER_MODEL_SKETCH   ?? "google/gemini-2.5-pro",
  explain:  process.env.OPENROUTER_MODEL_EXPLAIN  ?? "openai/gpt-5",
  // Chat defaults to Claude Sonnet — it starts emitting tokens within ~1s
  // vs GPT-5's 5–10s first-token latency, which is the difference between
  // "feels alive" and "feels broken" for a streaming chat widget.
  chat:     process.env.OPENROUTER_MODEL_CHAT     ?? "anthropic/claude-sonnet-4.5",
  fallback: process.env.OPENROUTER_MODEL_FALLBACK ?? "google/gemini-2.5-flash",
};

/**
 * Per-task fallback chain. If the primary model fails (timeout, 5xx, schema
 * violation), client.ts walks down the chain in order. Keep chains short — long
 * chains mean long worst-case latency.
 */
export const FALLBACK_CHAIN: Record<ModelTask, string[]> = {
  quote:   [MODELS.quote,   "openai/gpt-5",                MODELS.fallback],
  intel:   [MODELS.intel,   "google/gemini-2.5-pro",       MODELS.fallback],
  sketch:  [MODELS.sketch,  "anthropic/claude-sonnet-4.5", MODELS.fallback],
  explain: [MODELS.explain, "anthropic/claude-sonnet-4.5", MODELS.fallback],
  chat:    [MODELS.chat,    "openai/gpt-5",                MODELS.fallback],
  fallback:[MODELS.fallback],
};
