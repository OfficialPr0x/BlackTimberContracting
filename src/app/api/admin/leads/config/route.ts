import { requireAdminRoute } from "@/lib/admin/session";
import { isGeminiConfigured } from "@/lib/gemini/client";
import {
  getSerpApiConfigStatus,
  verifySerpApiConnection,
} from "@/lib/serpapi/client";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAdminRoute();
  if (!auth.ok) return auth.response;

  const serp = getSerpApiConfigStatus();
  const verify = new URL(req.url).searchParams.get("verifySerp") === "1";
  const serpVerify = verify && serp.configured ? await verifySerpApiConnection() : null;

  const openRouter = !!process.env.OPENROUTER_API_KEY?.trim();
  const geminiDirect = isGeminiConfigured();
  const prospectModel =
    process.env.OPENROUTER_MODEL_PROSPECT ??
    process.env.OPENROUTER_MODEL_INTEL ??
    "perplexity/sonar-pro";

  return Response.json({
    openRouter,
    serpApi: serp.configured,
    serpApiEnvVar: serp.envVar,
    serpApiVerified: serpVerify?.ok ?? null,
    serpApiVerifyError: serpVerify && !serpVerify.ok ? serpVerify.error : null,
    /** Direct Google Gemini API (optional — portfolio vision prefers this when set). */
    geminiDirect,
    /**
     * Portfolio photo analysis is available (OpenRouter vision fallback, or direct Gemini).
     * True whenever OpenRouter is configured — no separate GEMINI_API_KEY required.
     */
    portfolioVision: openRouter || geminiDirect,
    portfolioVisionVia: geminiDirect
      ? "gemini_api"
      : openRouter
        ? "openrouter"
        : null,
    supabase: isSupabaseConfigured(),
    prospectModel,
    /** Prospect synthesis + web search runs through OpenRouter (e.g. Perplexity Sonar). */
    prospectAi: openRouter,
  });
}
