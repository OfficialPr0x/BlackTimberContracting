/**
 * /api/admin/qr
 *   GET  → list saved QR codes with scan stats
 *   POST → create a saved, trackable QR code { label, destination }
 */

import { z } from "zod";
import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import { checkRate } from "@/lib/rate-limit";
import {
  listQrCodes,
  createQrCode,
  isQrTrackingAvailable,
} from "@/lib/admin/qr-codes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  label: z.string().trim().min(1, "Add a name for this QR code.").max(160),
  destination: z
    .string()
    .trim()
    .min(1, "Add a destination URL.")
    .max(2048),
});

export async function GET() {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    return Response.json({
      available: isQrTrackingAvailable(),
      codes: await listQrCodes(true),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    checkRate(req, "parse");

    if (!isQrTrackingAvailable()) {
      throw new AiError({
        code: "internal",
        status: 503,
        clientMessage:
          "Supabase isn't configured, so tracked QR codes can't be saved. The plain QR still downloads.",
      });
    }

    const json = await req.json().catch(() => null);
    const parsed = CreateSchema.safeParse(json);
    if (!parsed.success) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: parsed.error.issues[0]?.message ?? "Invalid request.",
      });
    }

    const code = await createQrCode(parsed.data);
    if (!code) {
      throw new AiError({
        code: "internal",
        status: 500,
        clientMessage: "Could not save the QR code. Try again.",
      });
    }

    return Response.json({ code });
  } catch (err) {
    return errorResponse(err);
  }
}
