/**
 * POST /api/leads
 *
 * Body: LeadInput (see src/lib/openrouter/schemas.ts)
 * Returns: { ok: true, delivered: { file, email, slack } }
 *
 * Fans out to whichever sinks are configured. File sink always runs so a lead
 * is never lost. Honeypot field `website` must be empty — bots tend to fill
 * every input, so a value there silently drops the request without telling
 * the bot why.
 */

import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { LeadInput } from "@/lib/openrouter/schemas";
import { checkRate } from "@/lib/rate-limit";
import { deliverLead } from "@/lib/leads/sink";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    checkRate(req, "leads");

    const json = await req.json().catch(() => null);
    if (!json) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Couldn't read your submission.",
      });
    }

    const parsed = LeadInput.safeParse(json);
    if (!parsed.success) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Some required fields are missing.",
        message: parsed.error.message,
      });
    }

    // Honeypot: bots fill every field. If `website` has any value, silently
    // accept the request (200 OK, no work done) so the bot moves on.
    if (parsed.data.website && parsed.data.website.length > 0) {
      return Response.json({ ok: true, delivered: { file: false, email: false, slack: false } });
    }

    const result = await deliverLead(parsed.data);

    return Response.json({ ok: true, leadId: result.leadId ?? null, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}
