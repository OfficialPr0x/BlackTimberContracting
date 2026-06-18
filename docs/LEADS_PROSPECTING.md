# Admin Leads — B2B Prospect Finder

Find East Kootenay developers, GCs, and design-build firms matched to Black Timber’s real portfolio.

## Setup

### 1. Supabase

Run in SQL Editor (after `schema.sql`):

```
supabase/prospect-leads-schema.sql
```

Creates `prospect_search_runs` and `prospect_leads`.

### 2. Environment (Vercel + `.env.local`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENROUTER_API_KEY` | Yes | Prospect synthesis (default: `perplexity/sonar-pro`) |
| `SUPABASE_SECRET_KEY` | For pipeline | Save prospects to database |
| `SERPAPI_API_KEY` or `SERPAPI_API` | Recommended | Google SERP grounding ([serpapi.com](https://serpapi.com)) |
| `SERPAPI_LOCATION` | Optional | Default geo for Google results (default: Cranbrook, BC) |
| `GEMINI_API_KEY` | Optional | Direct Google API for portfolio vision; if unset, **OpenRouter** runs vision (Gemini Flash via OpenRouter) |
| `OPENROUTER_MODEL_PROSPECT` | Optional | Override prospect model |
| `AI_MAX_USD_PROSPECT` | Optional | Per-search cost cap (default `0.85`) |
| `OPENROUTER_PROSPECT_WEB_TOOL` | Optional | Set `true` to add `openrouter:web_search` tool on fallbacks |

Without `GEMINI_API_KEY`, portfolio brief uses OpenRouter vision on sample job photos (no extra key needed).

### 3. Use

Open **Admin → Leads** → **Find** → run search → review **Pipeline** and update status.

Rate limit: 4 searches per 5 minutes per IP (admin session).
