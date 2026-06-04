"use client";

/**
 * Reads a draft document from sessionStorage and renders the branded print view.
 * Opened from the quote builder via "Preview PDF" (no save required).
 */

import { useEffect, useState } from "react";
import { Printer, ArrowLeft } from "lucide-react";
import BrandedDocument from "@/components/admin/BrandedDocument";
import type { BusinessProfile } from "@/lib/business-config";
import type { AdminQuoteSaved } from "@/lib/admin/schemas";
import { PREVIEW_STORAGE_KEY } from "@/lib/admin/draft-helpers";

export default function PreviewClient({ business }: { business: BusinessProfile }) {
  const [quote, setQuote] = useState<AdminQuoteSaved | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PREVIEW_STORAGE_KEY);
      if (!raw) {
        setError("No preview data. Go back to the builder and click Preview PDF again.");
        return;
      }
      setQuote(JSON.parse(raw) as AdminQuoteSaved);
    } catch {
      setError("Could not read preview data.");
    }
  }, []);

  if (error) {
    return (
      <div className="max-w-lg mx-auto py-20 px-6 text-center">
        <p className="text-red-300 text-sm mb-4">{error}</p>
        <a
          href="/admin"
          className="inline-flex items-center gap-2 text-brand-gold font-mono text-xs uppercase tracking-widest"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to builder
        </a>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="py-20 text-center text-brand-gray font-mono text-xs uppercase tracking-widest">
        Loading preview…
      </div>
    );
  }

  const isDraftPreview = quote.id.includes("PREVIEW");

  return (
    <>
      <header className="border-b border-brand-border bg-brand-charcoal/80 sticky top-0 z-30 print:hidden">
        <div className="max-w-[880px] mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <a
            href="/admin"
            className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-brand-gray hover:text-brand-gold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Builder
          </a>
          <div className="flex items-center gap-2">
            {isDraftPreview ? (
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400/90">
                Preview only — not saved
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-gold hover:bg-brand-gold-hover text-brand-black text-[10px] font-mono uppercase tracking-widest font-bold"
            >
              <Printer className="w-3.5 h-3.5" />
              Save as PDF
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[880px] mx-auto px-4 py-8 print:px-0 print:py-0">
        <p className="text-[11px] text-brand-gray mb-4 print:hidden font-mono text-center">
          In the print dialog, choose <strong className="text-brand-gold">Save as PDF</strong> and
          turn on <strong className="text-brand-gold">Background graphics</strong> for brand colors.
        </p>
        <BrandedDocument quote={quote} business={business} />
      </main>
    </>
  );
}
