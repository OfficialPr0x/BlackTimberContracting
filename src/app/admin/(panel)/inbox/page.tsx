import { requireAdminPage } from "@/lib/admin/page-auth";
import { listMailboxes } from "@/lib/email/repository";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { isResendConfigured } from "@/lib/resend/client";
import InboxWorkspace from "@/components/admin/email/InboxWorkspace";
import type { Mailbox } from "@/lib/email/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inbox · Black Timber Admin",
};

export default async function InboxPage() {
  await requireAdminPage("/admin/inbox");

  const supabaseReady = isSupabaseConfigured();
  const resendReady = isResendConfigured();

  let mailboxes: Mailbox[] = [];
  let loadError: string | null = null;
  if (supabaseReady) {
    try {
      mailboxes = await listMailboxes(true);
    } catch (err) {
      loadError = err instanceof Error ? err.message : "Failed to load mailboxes";
    }
  }

  return (
    <InboxWorkspace
      initialMailboxes={mailboxes}
      supabaseReady={supabaseReady}
      resendReady={resendReady}
      loadError={loadError}
    />
  );
}
