/**
 * /admin/preview — branded PDF preview without saving first.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";
import { getBusinessProfile } from "@/lib/business-config";
import PreviewClient from "./preview-client";

export const metadata: Metadata = {
  title: "Preview PDF · Black Timber Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPreviewPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?from=/admin/preview");

  const business = getBusinessProfile();

  return (
    <div className="min-h-screen bg-brand-black text-foreground print:bg-white">
      <PreviewClient business={business} />
    </div>
  );
}
