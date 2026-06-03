/**
 * /api/admin/quotes
 *
 *   POST  → create or update a quote (id is optional; absent = create)
 *   GET   → list the most recent quotes (max 50)
 *
 * Auth is enforced server-side via `requireAdminRoute()` — the proxy.ts
 * redirect is optimistic only and not load-bearing here.
 *
 * Server-side recompute: `saveQuote` re-derives subtotals, GST, PST, freight,
 * grand total, and lead time from the canonical schema. Client-supplied
 * totals are ignored. This is the contract that lets the frontend show
 * snappy live totals while still trusting the persisted record.
 */

import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import { AdminQuoteInput } from "@/lib/admin/schemas";
import { listQuotes, saveQuote } from "@/lib/admin/quotes";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const json = await req.json().catch(() => null);
    if (!json) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Couldn't read your request body.",
      });
    }

    const parsed = AdminQuoteInput.safeParse(json);
    if (!parsed.success) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Quote shape was invalid. Check required fields.",
        message: parsed.error.message,
      });
    }

    const saved = await saveQuote(parsed.data, "admin");
    return Response.json(saved);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET() {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const recent = await listQuotes(50);
    return Response.json({ quotes: recent });
  } catch (err) {
    return errorResponse(err);
  }
}
