import { requireAdminRoute } from "@/lib/admin/session";
import { isGeminiConfigured } from "@/lib/gemini/client";
import { isSerpApiConfigured } from "@/lib/serpapi/client";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminRoute();
  if (!auth.ok) return auth.response;

  return Response.json({
    openRouter: !!process.env.OPENROUTER_API_KEY?.trim(),
    serpApi: isSerpApiConfigured(),
    gemini: isGeminiConfigured(),
    supabase: isSupabaseConfigured(),
    prospectModel:
      process.env.OPENROUTER_MODEL_PROSPECT ??
      process.env.OPENROUTER_MODEL_INTEL ??
      "perplexity/sonar-pro",
  });
}
