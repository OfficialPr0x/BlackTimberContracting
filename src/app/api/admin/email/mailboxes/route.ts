import { z } from "zod";
import { requireAdminRoute } from "@/lib/admin/session";
import { emailErrorResponse } from "@/lib/email/http";
import { createMailbox, folderCounts, listMailboxes } from "@/lib/email/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  address: z.string().email().max(200),
  displayName: z.string().min(1).max(120),
  kind: z.enum(["shared", "personal"]).optional(),
  ownerLabel: z.string().max(120).nullish(),
  description: z.string().max(400).nullish(),
  signatureHtml: z.string().max(8000).nullish(),
});

export async function GET() {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const mailboxes = await listMailboxes(true);
    // Attach per-mailbox folder counts so the switcher can show unread badges.
    const counts = await Promise.all(
      mailboxes.filter((m) => m.active).map((m) => folderCounts(m.id))
    );
    const countsById: Record<string, unknown> = {};
    mailboxes
      .filter((m) => m.active)
      .forEach((m, i) => {
        countsById[m.id] = counts[i];
      });

    return Response.json({ mailboxes, counts: countsById });
  } catch (err) {
    return emailErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const body = CreateSchema.parse(await req.json());
    const mailbox = await createMailbox({
      address: body.address,
      displayName: body.displayName,
      kind: body.kind,
      ownerLabel: body.ownerLabel ?? null,
      description: body.description ?? null,
      signatureHtml: body.signatureHtml ?? null,
    });
    return Response.json({ mailbox }, { status: 201 });
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
