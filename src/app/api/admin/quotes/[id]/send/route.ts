/**
 * POST /api/admin/quotes/[id]/send
 *
 * Email a saved quote / estimate / invoice to the customer as a PDF attachment,
 * sent from jaryd@blacktimber.ca (the inbox mailbox when available, otherwise a
 * transactional Resend send). The browser generates the PDF and passes it here
 * as base64. On success the document is bumped draft → sent.
 */

import { z } from "zod";
import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import { checkRate } from "@/lib/rate-limit";
import { sendDocumentEmail } from "@/lib/admin/send-document-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BodySchema = z.object({
  to: z.array(z.string().max(200)).max(20).optional(),
  cc: z.array(z.string().max(200)).max(20).optional(),
  subject: z.string().max(300).optional(),
  message: z.string().max(8000).optional(),
  pdfBase64: z.string().min(100, "Missing document PDF."),
  filename: z.string().max(200).optional(),
  markSent: z.boolean().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    checkRate(req, "admin_chat");

    const { id } = await ctx.params;

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: parsed.error.issues[0]?.message ?? "Invalid request.",
      });
    }

    const result = await sendDocumentEmail({
      documentId: id,
      to: parsed.data.to,
      cc: parsed.data.cc,
      subject: parsed.data.subject,
      message: parsed.data.message,
      pdfBase64: parsed.data.pdfBase64,
      filename: parsed.data.filename,
      markSent: parsed.data.markSent,
    });

    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
