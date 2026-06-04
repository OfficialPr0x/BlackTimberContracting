/**
 * POST /api/admin/transcribe — OpenAI Whisper for admin Concierge voice input.
 */

import { errorResponse } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import { transcribeAudio } from "@/lib/openai/whisper";
import { checkRate } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    checkRate(req, "transcribe");

    const form = await req.formData();
    const file = form.get("audio");
    if (!(file instanceof File)) {
      return Response.json(
        { error: { message: "Missing audio file." } },
        { status: 400 }
      );
    }

    const text = await transcribeAudio(file);
    return Response.json({ text });
  } catch (err) {
    return errorResponse(err);
  }
}
