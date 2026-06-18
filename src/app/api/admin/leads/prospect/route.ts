import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import { ProspectSearchInput } from "@/lib/leads/prospect-schemas";
import { runProspectSearch } from "@/lib/leads/prospect-agent";
import { checkRate } from "@/lib/rate-limit";

export const runtime = "nodejs";
/** Vercel Pro allows up to 300s; Hobby caps at 60s. Keep search under ~55s wall time. */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    checkRate(req, "prospect_search");

    const json = await req.json().catch(() => null);
    const parsed = ProspectSearchInput.safeParse(json ?? {});
    if (!parsed.success) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Invalid prospect search request.",
        message: parsed.error.message,
      });
    }

    const result = await runProspectSearch(parsed.data);

    return Response.json({
      ...result.output,
      searchRunId: result.searchRunId,
      meta: {
        serpEnabled: result.serpEnabled,
        webSearchEnabled: result.webSearchEnabled,
        portfolioBriefUsed: result.portfolioBriefUsed,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
