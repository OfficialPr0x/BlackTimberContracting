import { requireAdminRoute } from "@/lib/admin/session";
import { emailErrorResponse } from "@/lib/email/http";
import {
  folderCounts,
  listMessages,
  listStarred,
} from "@/lib/email/repository";
import type { EmailCategory, EmailFolder } from "@/lib/email/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FOLDERS: EmailFolder[] = ["inbox", "sent", "drafts", "archive", "spam", "trash"];
const CATEGORIES: EmailCategory[] = ["primary", "promotions", "social", "updates", "forums"];

export async function GET(req: Request) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const url = new URL(req.url);
    const mailboxId = url.searchParams.get("mailboxId");
    if (!mailboxId) {
      return Response.json(
        { error: { code: "invalid_input", message: "mailboxId is required" } },
        { status: 400 }
      );
    }

    const folderParam = url.searchParams.get("folder") ?? "inbox";
    const search = url.searchParams.get("search") ?? undefined;
    const categoryParam = url.searchParams.get("category");
    const beforeDate = url.searchParams.get("before") ?? undefined;
    const limit = Number(url.searchParams.get("limit") ?? "50");

    let messages;
    if (folderParam === "starred") {
      messages = await listStarred(mailboxId, limit);
    } else {
      const folder = FOLDERS.includes(folderParam as EmailFolder)
        ? (folderParam as EmailFolder)
        : "inbox";
      const category =
        categoryParam && CATEGORIES.includes(categoryParam as EmailCategory)
          ? (categoryParam as EmailCategory)
          : undefined;
      messages = await listMessages({
        mailboxId,
        folder,
        category,
        search,
        beforeDate,
        limit,
      });
    }

    const counts = await folderCounts(mailboxId);
    return Response.json({ messages, counts });
  } catch (err) {
    return emailErrorResponse(err);
  }
}
