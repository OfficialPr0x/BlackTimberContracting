import { errorResponse } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import { deleteInvoicePayment } from "@/lib/admin/invoice-payments";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; paymentId: string }> }
) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const { id, paymentId } = await ctx.params;
    const summary = await deleteInvoicePayment(id, paymentId);
    return Response.json(summary);
  } catch (err) {
    return errorResponse(err);
  }
}
