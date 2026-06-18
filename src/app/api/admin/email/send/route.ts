import { z } from "zod";
import { requireAdminRoute } from "@/lib/admin/session";
import { composeAndSend } from "@/lib/email/compose";
import { emailErrorResponse } from "@/lib/email/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const AddressList = z.array(z.string().email()).max(50);

const SendSchema = z.object({
  mailboxId: z.string().uuid(),
  to: AddressList.min(1),
  cc: AddressList.optional(),
  bcc: AddressList.optional(),
  subject: z.string().max(500).default(""),
  html: z.string().max(500_000).default(""),
  text: z.string().max(500_000).optional(),
  inReplyToMessageId: z.string().uuid().optional(),
  forwardMessageId: z.string().uuid().optional(),
  tags: z.record(z.string(), z.string()).optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string().min(1).max(260),
        content: z.string(), // base64
        contentType: z.string().max(160).optional(),
      })
    )
    .max(20)
    .optional(),
});

export async function POST(req: Request) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const body = SendSchema.parse(await req.json());
    const result = await composeAndSend({
      mailboxId: body.mailboxId,
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      html: body.html,
      text: body.text,
      inReplyToMessageId: body.inReplyToMessageId,
      forwardMessageId: body.forwardMessageId,
      tags: body.tags,
      attachments: body.attachments,
    });
    return Response.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid input" } },
        { status: 400 }
      );
    }
    return emailErrorResponse(err);
  }
}
