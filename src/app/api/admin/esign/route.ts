import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import { listEsignEnvelopes } from "@/lib/esign/repository";
import { createEsignFromQuote, createEsignFromVaultFile } from "@/lib/esign/create-from-source";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateBody = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("quote"),
    documentId: z.string().regex(/^[QEI]-\d{8}-[A-Z0-9]{4}$/),
    signerName: z.string().min(1).max(120).optional(),
    signerEmail: z.string().email().max(200).optional(),
    signerMessage: z.string().max(2000).optional(),
    sendNow: z.boolean().optional(),
  }),
  z.object({
    source: z.literal("vault_file"),
    fileId: z.string().uuid(),
    signerName: z.string().min(1).max(120),
    signerEmail: z.string().email().max(200),
    title: z.string().max(255).optional(),
    sendNow: z.boolean().optional(),
  }),
]);

export async function GET() {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const envelopes = await listEsignEnvelopes(80);
    return Response.json({ envelopes });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const json = await req.json().catch(() => null);
    const parsed = CreateBody.safeParse(json);
    if (!parsed.success) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Invalid e-sign request.",
        message: parsed.error.message,
      });
    }

    const result =
      parsed.data.source === "quote"
        ? await createEsignFromQuote(parsed.data)
        : await createEsignFromVaultFile(parsed.data);

    return Response.json({
      envelope: result.envelope,
      signUrl: result.envelope.signUrl,
      emailErrors: result.emailErrors,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
