import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import {
  addInvoicePayment,
  buildPaymentSummary,
} from "@/lib/admin/invoice-payments";
import { InvoicePaymentInput } from "@/lib/admin/schemas";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const { id } = await ctx.params;
    if (!id.startsWith("I-")) {
      return Response.json(
        { error: { message: "Payments apply to invoices only." } },
        { status: 400 }
      );
    }

    const summary = await buildPaymentSummary(id);
    return Response.json(summary);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const { id } = await ctx.params;
    if (!id.startsWith("I-")) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Payments apply to invoices only.",
      });
    }

    const json = await req.json().catch(() => null);
    const parsed = InvoicePaymentInput.safeParse(json);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: issue?.message ?? "Invalid payment.",
      });
    }

    const summary = await addInvoicePayment(id, parsed.data, "admin");
    return Response.json(summary);
  } catch (err) {
    return errorResponse(err);
  }
}
