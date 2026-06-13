"use client";

/**
 * Saved document view — loads from server props, sessionStorage (just saved),
 * or GET /api/admin/quotes/[id] so "Save & open PDF" works on Vercel.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader, Pencil, Trash2 } from "lucide-react";
import BrandedDocument, { idToDocType } from "@/components/admin/BrandedDocument";
import DownloadPdfButton from "@/components/pdf/DownloadPdfButton";
import { documentPdfFilename } from "@/lib/pdf/filename";
import { downloadDocumentFromPage } from "@/lib/pdf/download-document-pdf";
import type { BusinessProfile } from "@/lib/business-config";
import InvoicePaymentTracker from "@/components/admin/InvoicePaymentTracker";
import type { AdminQuoteSaved, InvoicePaymentSummary } from "@/lib/admin/schemas";
import { readCachedSavedDocument } from "@/lib/admin/saved-doc-cache";

interface QuoteDetailViewProps {
  id: string;
  initialQuote: AdminQuoteSaved | null;
  business: BusinessProfile;
}

export default function QuoteDetailView({
  id,
  initialQuote,
  business,
}: QuoteDetailViewProps) {
  const router = useRouter();
  const [quote, setQuote] = useState<AdminQuoteSaved | null>(initialQuote);
  const [loading, setLoading] = useState(!initialQuote);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [payments, setPayments] = useState<InvoicePaymentSummary | null>(null);

  useEffect(() => {
    if (initialQuote) return;

    const cached = readCachedSavedDocument(id);
    if (cached) {
      setQuote(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/quotes/${encodeURIComponent(id)}`);
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(
            body?.error?.message ??
              "This document was not found. Save again from the builder, or configure Supabase on Vercel so saves persist."
          );
          setLoading(false);
          return;
        }
        setQuote(body as AdminQuoteSaved);
      } catch {
        if (!cancelled) {
          setError("Could not load this document. Check your connection and try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, initialQuote]);

  useEffect(() => {
    if (!id.startsWith("I-")) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/quotes/${encodeURIComponent(id)}/payments`);
        const body = await res.json();
        if (!cancelled && res.ok) setPayments(body as InvoicePaymentSummary);
      } catch {
        /* payments optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!quote || loading) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("download") !== "1") return;

    const filename = documentPdfFilename({
      id: quote.id,
      documentType: quote.documentType,
      customerName: quote.customer.name,
    });

    void downloadDocumentFromPage(filename)
      .catch((e) => {
        setDownloadError(
          e instanceof Error ? e.message : "Could not generate the PDF. Try the Download button.",
        );
      })
      .finally(() => {
        window.history.replaceState({}, "", window.location.pathname);
      });
  }, [quote, loading]);

  const handleDelete = async () => {
    if (
      !confirm(
        `Delete ${id} permanently? This removes the document and any synced vault archives.`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/quotes/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message ?? "Delete failed");
      router.push("/admin/quotes");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
    }
  };

  const docType = quote ? (quote.documentType ?? idToDocType(quote.id)) : idToDocType(id);
  const headline =
    docType === "invoice" ? "Invoice" : docType === "estimate" ? "Estimate" : "Quote";

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-black flex items-center justify-center">
        <p className="text-brand-gray font-mono text-xs uppercase tracking-widest flex items-center gap-2">
          <Loader className="w-4 h-4 animate-spin" />
          Loading {headline.toLowerCase()}…
        </p>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-brand-black text-foreground">
        <div className="max-w-lg mx-auto py-20 px-6 text-center">
          <h1 className="text-lg font-mono text-brand-gold uppercase tracking-widest mb-3">
            {headline} not found
          </h1>
          <p className="text-sm text-brand-gray mb-2">{id}</p>
          <p className="text-sm text-red-300/90 mb-6">
            {error ??
              "The save may not have persisted. On production, add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, run supabase/schema.sql, then save again."}
          </p>
          <a
            href="/admin/quotes"
            className="inline-flex items-center gap-2 text-brand-gold font-mono text-xs uppercase tracking-widest"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to builder
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-black text-foreground print:bg-white">
      <header className="border-b border-brand-border bg-brand-charcoal/60 backdrop-blur-sm sticky top-0 z-30 print:hidden">
        <div className="max-w-[880px] mx-auto px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <a
              href="/admin/quotes"
              className="text-[10px] font-mono uppercase tracking-widest text-brand-gray hover:text-brand-gold"
            >
              ← Builder
            </a>
            <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-brand-gold">
              {headline} {quote.id}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={`/admin/quotes?edit=${encodeURIComponent(quote.id)}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-brand-border hover:border-brand-gold text-[10px] font-mono uppercase tracking-widest text-brand-gray hover:text-brand-gold transition-colors"
            >
              <Pencil className="w-3 h-3" />
              Edit in builder
            </a>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-500/40 hover:bg-red-500/10 text-[10px] font-mono uppercase tracking-widest text-red-300 transition-colors disabled:opacity-50"
            >
              {deleting ? <Loader className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Delete
            </button>
            <DownloadPdfButton
              filename={documentPdfFilename({
                id: quote.id,
                documentType: quote.documentType,
                customerName: quote.customer.name,
              })}
              label="Download PDF"
              onError={(message) => setDownloadError(message)}
            />
          </div>
        </div>
      </header>

      <main className="max-w-[880px] mx-auto px-4 py-10 print:px-0 print:py-0 print:max-w-none">
        <p className="text-[11px] text-brand-gray mb-4 print:hidden font-mono">
          One-click download — branded PDF with logo, line items, and totals.
        </p>
        {downloadError ? (
          <div className="mb-6 print:hidden rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 flex items-start justify-between gap-4">
            <p className="text-xs text-red-300">{downloadError}</p>
            <button
              type="button"
              onClick={() => setDownloadError(null)}
              className="text-[10px] font-mono uppercase tracking-widest text-red-300/70 hover:text-red-200 shrink-0"
            >
              Dismiss
            </button>
          </div>
        ) : null}
        {docType === "invoice" ? (
          <div className="mb-8 print:hidden rounded-xl border border-brand-border bg-brand-charcoal/40 p-5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-brand-gold mb-4">
              Record payment
            </p>
            <InvoicePaymentTracker
              invoiceId={quote.id}
              grandTotalCAD={quote.totals.grandTotalCAD}
              onSummaryChange={setPayments}
              onStatusChange={(status) => setQuote((q) => (q ? { ...q, status } : q))}
            />
          </div>
        ) : null}
        <BrandedDocument quote={quote} business={business} payments={payments} />
      </main>
    </div>
  );
}
