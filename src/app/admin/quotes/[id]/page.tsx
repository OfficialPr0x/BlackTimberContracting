/**
 * /admin/quotes/[id] — saved document view + Print → PDF.
 *
 * Branding (logo, gold, charcoal) lives in BrandedDocument.tsx — not OpenRouter.
 * Cmd+K / AI only fills the form; save, then open this page and Print.
 */

import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";

import { getAdminSession } from "@/lib/admin/session";
import { loadQuote } from "@/lib/admin/quotes";
import { getBusinessProfile } from "@/lib/business-config";
import BrandedDocument, { idToDocType } from "@/components/admin/BrandedDocument";
import { logoutAction } from "../../actions";
import PrintButton from "./print-button";

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

  const quote = await loadQuote(id);
  if (!quote) notFound();

  const business = getBusinessProfile();
  const docType = quote.documentType ?? idToDocType(quote.id);
  const headline =
    docType === "invoice" ? "Invoice" : docType === "estimate" ? "Estimate" : "Quote";

  return (
    <div className="min-h-screen bg-brand-black text-foreground print:bg-white">
      <header className="border-b border-brand-border bg-brand-charcoal/60 backdrop-blur-sm sticky top-0 z-30 print:hidden">
        <div className="max-w-[880px] mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <a
              href="/admin"
              className="text-[10px] font-mono uppercase tracking-widest text-brand-gray hover:text-brand-gold"
            >
              ← Builder
            </a>
            <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-brand-gold">
              {headline} {quote.id}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <PrintButton />
            <form action={logoutAction}>
              <button
                type="submit"
                className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-brand-gray hover:text-brand-gold border border-brand-border rounded-md"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-[880px] mx-auto px-4 py-10 print:px-0 print:py-0 print:max-w-none">
        <p className="text-[11px] text-brand-gray mb-4 print:hidden font-mono">
          Print or Save as PDF — branded {headline.toLowerCase()} with your logo and colors.
        </p>
        <BrandedDocument quote={quote} business={business} />
      </main>
    </div>
  );
}
