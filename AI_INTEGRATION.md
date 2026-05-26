# Black Timber AI Integration — Operator Guide

End-to-end OpenRouter integration powering the five AI tools on the site:
**Quote Wizard**, **Property Intelligence**, **Draw It Out**, **Cost Calculator
AI sanity-check**, and the floating **Concierge Chat**.

This doc is the single source of truth for **how it works, how to run it, and
how to tune it**. If something in the codebase contradicts this, the codebase
wins — bump this doc.

---

## 1. 60-second start

```powershell
# 1. Copy the env template
Copy-Item .env.local.example .env.local

# 2. Open .env.local and paste your OpenRouter key
#    Get one at https://openrouter.ai/keys (fund ~$10 for full testing)

# 3. Restart the dev server so it picks up the env var
#    (Stop the running `npm run dev` terminal, then start again)
npm run dev
```

Every AI tool on the homepage will work immediately. Lead-form submissions are
appended to `./.data/leads.jsonl` until you add email + Slack credentials.

---

## 2. Architecture at a glance

```
Client (browser)                  Server (Next.js Route Handler)
─────────────────                  ──────────────────────────────────────
QuoteWizard.tsx       ──fetch──▶  /api/ai/quote          → OpenRouter (vision)
ProjectCheck.tsx      ──fetch──▶  /api/ai/site-intel     → OpenRouter (web-grounded)
DrawItOut.tsx         ──fetch──▶  /api/ai/draw-render    → OpenRouter (vision)
CostCalculator.tsx    ──fetch──▶  /api/ai/explain-price  → OpenRouter (text)
ConciergeChat.tsx     ──stream──▶ /api/ai/concierge      → OpenRouter (text, SSE)
All lead forms        ──fetch──▶  /api/leads             → file + email + Slack
```

**The API key never leaves the server.** All five client components hit
relative `/api/ai/*` paths; the Node.js process holds `OPENROUTER_API_KEY`
and proxies the request.

### File map

```
src/lib/openrouter/
  client.ts        Direct OpenRouter fetch wrapper. Fallback chain, timeouts,
                   JSON-schema enforcement, cost cap, SSE streaming, LRU cache.
  models.ts        Model routing per task (env-overridable).
  prompts.ts       Versioned system prompts for every tool.
  schemas.ts       Zod schemas for every request + response. Single source of
                   truth for both the route validators AND the AI's JSON shape.
  errors.ts        Typed `AiError` + `errorResponse()` helper.

src/lib/
  rate-limit.ts    In-memory sliding-window per-IP. Profiles for each route.
  logger.ts        NDJSON structured logs for AI calls + lead events.
  leads/sink.ts    Multi-sink delivery (file + Resend + Slack).

src/app/api/
  ai/quote/route.ts            Vision + structured estimate
  ai/site-intel/route.ts       Address → grounded site brief (30 min cache)
  ai/draw-render/route.ts      Sketch interpretation + portfolio match
  ai/explain-price/route.ts    Narrative + sanity-check on calculator output
  ai/concierge/route.ts        SSE streaming chat
  leads/route.ts               Lead capture (multi-sink fan-out)
```

---

## 3. Environment variables

Everything is documented in `.env.local.example`. Quick reference:

| Variable | Required? | What it does |
|---|---|---|
| `OPENROUTER_API_KEY` | **Yes** | All AI tools need this. Get one at https://openrouter.ai/keys |
| `OPENROUTER_SITE_URL` | recommended | Sent as `HTTP-Referer` to OpenRouter (analytics attribution). Set to your production URL when you deploy. |
| `OPENROUTER_SITE_NAME` | recommended | Sent as `X-Title`. Shows up in your OpenRouter dashboard. |
| `OPENROUTER_MODEL_*` | optional | Override the default model per task. See section 4. |
| `AI_MAX_USD_PER_REQUEST` | optional | Per-call cost ceiling. Default `0.50`. Logs a warning if exceeded. |
| `RESEND_API_KEY` + `LEAD_NOTIFICATION_EMAIL` | optional | Enables email delivery of leads. (`resend` package is already installed.) |
| `LEAD_FROM_EMAIL` | optional | The `From:` address on outgoing lead emails. |
| `SLACK_LEADS_WEBHOOK` | optional | Slack incoming webhook URL. |
| `LEAD_LOG_FILE` | optional | Path to lead JSONL log. Default `./.data/leads.jsonl`. |

The file-sink for leads **always runs** even with zero env config — a lead is
never lost.

---

## 4. Model routing

Defaults (mid-2026 best-of-class) live in `src/lib/openrouter/models.ts`:

| Task | Default model | Why |
|---|---|---|
| `quote` | `anthropic/claude-sonnet-4.5` | Best structured-output adherence; strong vision |
| `intel` | `perplexity/sonar-reasoning-pro` | Built-in web grounding — no hallucinated snow loads |
| `sketch` | `google/gemini-2.5-pro` | Top vision model right now |
| `explain` | `openai/gpt-5` | Fast, low-latency narrative text |
| `chat` | `openai/gpt-5` | Same as above, for streaming concierge |
| `fallback` | `google/gemini-2.5-flash` | Cheap last-resort when primaries 5xx |

**Fallback chain** runs automatically on any 5xx, timeout, or schema violation.
Defined in the same file. Each chain is 2–3 models long; keep it short to
bound worst-case latency.

**To try a different model** without redeploying, set the env var (e.g.
`OPENROUTER_MODEL_QUOTE=anthropic/claude-opus-4.5`) and restart the server.

Browse the full catalog + per-token pricing at https://openrouter.ai/models

---

## 5. Hardening built in (don't remove)

| Safeguard | Where | Why |
|---|---|---|
| Zod input validation | every `/api/ai/*` route | Garbage requests fail at the edge with a clear 400 |
| Zod output validation | `chatJSON()` in `client.ts` | Model returns garbage → falls to next model in chain instead of crashing the UI |
| Per-IP rate limiting | `lib/rate-limit.ts` | Stops casual abuse from running up the OpenRouter bill |
| Per-request cost cap | `chatJSON()` | Warns when any single call exceeds `AI_MAX_USD_PER_REQUEST` |
| Fallback chain | `lib/openrouter/models.ts` | Single model outage doesn't kill the tool |
| Honeypot on lead forms | `LeadInput.website` | Bots fill every field; non-empty value = silently dropped (200, no delivery) |
| 30-min cache on site-intel | `cachedChatJSON()` | Same address = same answer = no duplicate spend |
| Always-on file sink for leads | `lib/leads/sink.ts` | Lead never lost, even if email / Slack misconfigured |
| Structured NDJSON logs | `lib/logger.ts` | Every AI call logs `{task, model, tokens, costUSD, latencyMs}` — pipe to Datadog/Logflare later |

---

## 6. Tuning + monitoring

### Watch the logs

Every AI call emits a one-line JSON record to stdout, like:

```json
{"ts":"2026-05-26T04:11:23Z","level":"info","kind":"ai_call","task":"quote","model":"anthropic/claude-sonnet-4.5","schemaName":"QuoteOutput","promptTokens":1234,"completionTokens":567,"costUSD":0.0089,"latencyMs":4231,"ok":true}
```

Grep your dev terminal or your hosting platform's logs for `"kind":"ai_call"`.

### Lead delivery records

```json
{"ts":"...","level":"info","kind":"lead","source":"quote_wizard","email":"...","delivered":{"file":true,"email":true,"slack":true},"errors":[]}
```

### Common operations

- **Disable a tool temporarily** — comment out the route file's `POST` handler,
  or have it `return Response.json({error:{...}}, {status:503})`. Client UIs
  already handle errors gracefully and fall back to deterministic content.
- **Adjust rate limits** — edit `LIMITS` in `src/lib/rate-limit.ts`.
- **Swap a model for testing** — set the env var, restart.
- **Inspect the lead log** — `Get-Content .\.data\leads.jsonl | ConvertFrom-Json`
- **Clear the in-memory cache** — restart the process. (Cache is per-instance.)

### When to upgrade infra

- **Multi-region / busy Vercel deployment** → swap `lib/rate-limit.ts` for
  `@upstash/ratelimit` (same `checkRate()` signature).
- **Persistent logs / dashboards** → replace `emit()` in `lib/logger.ts` with
  Datadog/Logflare/Axiom SDK call. No route-level changes needed.
- **True AI image generation in Draw It Out** → add a second provider (Gemini
  image / Flux via Fal/Replicate). Currently we smart-match to real portfolio
  photos — more honest, but not a "wow render".

---

## 7. Known boundaries (be honest with customers)

1. **Quotes are estimates.** Every quote response includes a `disclaimer`
   field. The UI must show it. Final price always requires a site visit.
2. **Site intel can be wrong.** Even with web grounding, snow loads + frost
   lines can be subtly off for very rural BC properties. The schema includes
   a `confidence` field — when "low", encourage the client to call Jaryd.
3. **DrawItOut doesn't generate renders.** It interprets the sketch and shows
   the closest REAL portfolio photo. Don't oversell it as "AI render".
4. **Rate limits are best-effort.** In-memory state means a busy multi-instance
   deployment will leak some over-limit calls. Combined with cost caps, the
   blast radius is bounded.

---

## 8. Adding a new AI tool

1. Add request + response schemas to `src/lib/openrouter/schemas.ts`.
2. Add a system prompt to `src/lib/openrouter/prompts.ts`.
3. Add a model + fallback chain entry in `src/lib/openrouter/models.ts`.
4. Add a rate limit profile in `src/lib/rate-limit.ts` (`LIMITS`).
5. Create `src/app/api/ai/<tool>/route.ts` following the pattern of the
   existing routes (validate → `chatJSON()` → return).
6. Wire your client component to `fetch("/api/ai/<tool>", ...)`.
7. Document it here.

---

## 9. Vercel deployment notes

- All env vars from `.env.local.example` need to be set in the Vercel project
  dashboard (Settings → Environment Variables).
- Set `OPENROUTER_SITE_URL` to your production domain.
- The `LEAD_LOG_FILE` path won't persist between serverless invocations on
  Vercel — switch to email + Slack delivery (or a real DB) for production.
- All routes use `export const runtime = "nodejs"` — required for `fs` and
  for OpenRouter's longer-running vision calls. Don't change to `edge`
  without verifying.
- `export const maxDuration = 60/90` lifts the default 10s Vercel timeout
  for the slow vision + streaming routes. Increase if you see 504s in prod.
