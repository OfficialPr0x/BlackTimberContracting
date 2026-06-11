import { z } from "zod";
import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { checkRate } from "@/lib/rate-limit";
import { verifyGuideSubscriber } from "@/lib/guide/repository";
import { createGuideSession, isGuideSessionConfigured } from "@/lib/guide/session";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email().max(200),
  password: z.string().min(6).max(40),
});

export async function POST(req: Request) {
  try {
    checkRate(req, "leads");

    if (!isGuideSessionConfigured()) {
      throw new AiError({
        code: "internal",
        status: 503,
        clientMessage: "Guide login is not configured on this server.",
      });
    }

    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Enter the email and password from your welcome message.",
      });
    }

    const sub = await verifyGuideSubscriber(parsed.data.email, parsed.data.password);
    if (!sub) {
      throw new AiError({
        code: "invalid_input",
        status: 401,
        clientMessage: "Email or password is incorrect.",
      });
    }

    await createGuideSession({
      email: sub.email,
      subscriberId: sub.id,
      guideSlug: sub.guideSlug,
    });

    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
