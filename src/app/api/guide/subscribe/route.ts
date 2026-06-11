import { z } from "zod";
import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { checkRate } from "@/lib/rate-limit";
import { deliverLead } from "@/lib/leads/sink";
import { createOrRefreshGuideSubscriber, markWelcomeEmailSent } from "@/lib/guide/repository";
import { sendGuideWelcomeEmail } from "@/lib/guide/emails";
import { generateGuidePassword, hashGuidePassword } from "@/lib/guide/password";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(200),
  website: z.string().max(2000).optional(),
  page: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  try {
    checkRate(req, "leads");

    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Name and a valid email are required.",
      });
    }

    if (parsed.data.website && parsed.data.website.length > 0) {
      return Response.json({ ok: true });
    }

    const { name, email, page } = parsed.data;
    const password = generateGuidePassword();
    const passwordHash = hashGuidePassword(password);

    const leadResult = await deliverLead({
      source: "exit_intent",
      contact: { name, email },
      payload: {
        tags: ["exit-intent", "field-guide", "kootenay-manual", "homepage"],
        offer: "Kootenay Field Guide — Project Readiness & Resilience Manual",
        page: page ?? "/",
        guideSlug: "kootenay-field-guide",
      },
    });

    const sub = await createOrRefreshGuideSubscriber({
      name,
      email,
      leadId: leadResult.leadId ?? null,
      password,
      passwordHash,
    });

    if (!sub) {
      throw new AiError({
        code: "internal",
        status: 500,
        clientMessage: "Could not create your guide access. Please try again.",
      });
    }

    let emailSent = false;
    let emailError: string | null = null;
    if (process.env.RESEND_API_KEY) {
      try {
        await sendGuideWelcomeEmail({
          to: sub.email,
          name: sub.name,
          password: sub.password,
        });
        emailSent = true;
        await markWelcomeEmailSent(sub.subscriberId, true);
      } catch (err) {
        emailError = err instanceof Error ? err.message : "Email failed";
        await markWelcomeEmailSent(sub.subscriberId, false, emailError);
      }
    } else {
      emailError = "Email service not configured";
    }

    return Response.json({
      ok: true,
      password: sub.password,
      guideUrl: "/guide",
      email: sub.email,
      emailSent,
      emailError,
      guideLoginReady: true,
      leadId: leadResult.leadId ?? null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
