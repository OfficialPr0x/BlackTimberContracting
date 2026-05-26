/**
 * Tiny in-memory sliding-window rate limiter.
 *
 * Scope: a single Node process (works for `next dev` + single-instance Vercel
 * functions). On serverless, each cold start gets its own state — so this is
 * best-effort, not bulletproof. Combined with the per-request cost cap and the
 * honeypot field on lead forms, it's enough to keep casual abuse from running
 * up the OpenRouter bill.
 *
 * When you need real distributed rate limiting (multi-region Vercel, or a busy
 * site), swap `bucket` for Upstash Redis via @upstash/ratelimit — the public
 * `checkRate()` signature stays the same.
 */

import { AiError } from "./openrouter/errors";

type Bucket = { times: number[] };
const bucket = new Map<string, Bucket>();

// Cap memory growth: drop oldest keys when over this.
const MAX_KEYS = 5000;

export interface RateLimit {
  /** Stable identifier for the route, e.g. "quote". */
  key: string;
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
}

/**
 * Production rate-limit profiles — tune as we see real traffic.
 * Lead forms are stricter than AI calls because submissions are the spam target.
 */
export const LIMITS = {
  quote:    { limit: 3,  windowSec: 60 },   // 3/min per IP
  intel:    { limit: 5,  windowSec: 60 },   // 5/min per IP
  sketch:   { limit: 6,  windowSec: 60 },   // 6/min per IP — drawings are short calls
  explain:  { limit: 20, windowSec: 60 },   // 20/min — cheap explanatory text
  chat:     { limit: 30, windowSec: 60 },   // 30/min for streaming chat
  leads:    { limit: 5,  windowSec: 300 },  // 5/5min per IP — strict (anti-spam)
} as const satisfies Record<string, { limit: number; windowSec: number }>;

export type LimitName = keyof typeof LIMITS;

/**
 * Extract the client IP from a Next.js Request. Trusts the x-forwarded-for
 * header set by Vercel / Cloudflare / any standard reverse proxy.
 */
export function clientIP(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/**
 * Throws `AiError("rate_limited")` if the IP has exceeded the limit. Otherwise
 * records the hit and returns silently.
 */
export function checkRate(req: Request, limit: LimitName): void {
  const ip = clientIP(req);
  const { limit: max, windowSec } = LIMITS[limit];
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const key = `${limit}:${ip}`;

  const b = bucket.get(key) ?? { times: [] };
  b.times = b.times.filter((t) => now - t < windowMs);

  if (b.times.length >= max) {
    const retryAfterSec = Math.ceil((windowMs - (now - b.times[0]!)) / 1000);
    throw new AiError({
      code: "rate_limited",
      status: 429,
      clientMessage: `Slow down — try again in ${retryAfterSec}s. (If you need help right now, call 250-919-8476.)`,
      message: `rate limit ${limit} hit by ${ip} (${b.times.length + 1} > ${max})`,
    });
  }

  b.times.push(now);
  bucket.set(key, b);

  // Cheap LRU-ish eviction
  if (bucket.size > MAX_KEYS) {
    const firstKey = bucket.keys().next().value;
    if (firstKey !== undefined) bucket.delete(firstKey);
  }
}
