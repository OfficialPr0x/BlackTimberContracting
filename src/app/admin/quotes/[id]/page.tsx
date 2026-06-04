/**
 * /admin/quotes/[id] — saved document view + Print → PDF.
 *
 * Branding (logo, gold, charcoal) lives in BrandedDocument.tsx — not OpenRouter.
 * Cmd+K / AI only fills the form; save, then open this page and Print.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAdminSession } from "@/lib/admin/session";
import { loadQuote } from "@/lib/admin/quotes";
import { getBusinessProfile } from "@/lib/business-config";
import { idToDocType } from "@/components/admin/BrandedDocument";
import QuoteDetailView from "./quote-detail-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const docKind = idToDocType(id);
  const titleWord =
    docKind === "invoice" ? "Invoice" : docKind === "estimate" ? "Estimate" : "Quote";
  return {
    title: `${titleWord} ${id} · Black Timber`,
    robots: { index: false, follow: false },
  };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function QuoteDetailPage({ params }: PageProps) {
  const session = await getAdminSession();
  const { id } = await params;
  if (!session) redirect(`/admin/login?from=/admin/quotes/${id}`);

  const business = getBusinessProfile();
  const quote = await loadQuote(id);

  return <QuoteDetailView id={id} initialQuote={quote} business={business} />;
}
