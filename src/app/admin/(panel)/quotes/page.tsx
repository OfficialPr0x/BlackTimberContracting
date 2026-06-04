import type { Metadata } from "next";
import { listQuotes } from "@/lib/admin/quotes";
import QuoteBuilder from "@/app/admin/quote-builder";

export const metadata: Metadata = {
  title: "Quotes · Black Timber Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminQuotesPage() {
  let recentQuotes: Awaited<ReturnType<typeof listQuotes>> = [];
  try {
    recentQuotes = await listQuotes(25);
  } catch (err) {
    console.error("[admin/quotes] listQuotes failed", err);
  }

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brand-gold">
          Quote builder
        </p>
        <h1 className="text-xl sm:text-2xl font-medium text-white mt-0.5">
          Quotes · Estimates · Invoices
        </h1>
        <p className="text-xs text-brand-gray mt-1">
          Fernie HH grounded · Cmd+K Talk to AI · branded PDF
        </p>
      </header>
      <QuoteBuilder
        initialRecentQuotes={recentQuotes.map((q) => ({
          id: q.id,
          customerName: q.customer.name,
          grandTotalCAD: q.totals.grandTotalCAD,
          updatedAt: q.updatedAt,
          status: q.status,
        }))}
      />
    </div>
  );
}
