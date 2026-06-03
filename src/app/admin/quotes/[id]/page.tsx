/**
 * /admin/quotes/[id] — saved-quote view, print-optimized.
 *
 * This is the page the contractor opens to:
 *   - inspect a saved quote
 *   - print to PDF (Ctrl/Cmd + P) and send to the customer
 *
 * Print rules:
 *   - The header bar, sidebar, and any non-essential UI are hidden via
 *     `print:hidden`.
 *   - Backgrounds collapse to white, text to black, gold accents stay.
 *   - The whole document fits on letter / A4 with sensible margins.
 *
 * Auth: re-verifies via `getAdminSession()` server-side before reading the
 * saved record (the proxy redirect is optimistic only).
 */

import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";

import { getAdminSession } from "@/lib/admin/session";
import { loadQuote } from "@/lib/admin/quotes";
import type { AdminQuoteSaved, AdminQuoteTaxMode } from "@/lib/admin/schemas";
import { logoutAction } from "../../actions";
import PrintButton from "./print-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Quote ${id} · Black Timber`,
    robots: { index: false, follow: false },
  };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

const TAX_MODE_LABEL: Record<AdminQuoteTaxMode, string> = {
  real_property_install: "Installed into real property",
  supply_only: "Supply only",
  mixed_split: "Mixed (split contract)",
  exempt: "PST exempt",
};

const SOURCE_LABEL: Record<string, string> = {
  fernie_hh_stocked: "Fernie HH (stocked)",
  fernie_hh_special_order: "Fernie HH (special order)",
  other_supplier: "Other supplier",
  labor: "Labor",
  subcontractor: "Subcontractor",
  other: "—",
};

function fmtCAD(n: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string): string {
  // Render in Canada/Pacific-style locale; full date for the quote header.
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function QuoteDetailPage({ params }: PageProps) {
  const session = await getAdminSession();
  const { id } = await params;
  if (!session) redirect(`/admin/login?from=/admin/quotes/${id}`);

  const quote = await loadQuote(id);
  if (!quote) notFound();

  return (
    <div className="min-h-screen bg-brand-black text-foreground print:bg-white print:text-black">
      {/* ---- Top bar (hidden in print) ---- */}
      <header className="border-b border-brand-border bg-brand-charcoal/60 backdrop-blur-sm sticky top-0 z-30 print:hidden">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <a
              href="/admin"
              className="text-[10px] font-mono uppercase tracking-widest text-brand-gray hover:text-brand-gold"
            >
              ← Back to builder
            </a>
            <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-brand-gold">
              Quote {quote.id}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <PrintButton />
            <form action={logoutAction}>
              <button
                type="submit"
                className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-brand-gray hover:text-brand-gold border border-brand-border rounded-md transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ---- The actual quote document (printable) ---- */}
      <main className="max-w-5xl mx-auto px-6 py-10 print:px-0 print:py-0">
        <article className="bg-brand-charcoal/40 border border-brand-border rounded-xl p-8 print:p-0 print:border-0 print:bg-white">
          <QuoteDocument quote={quote} />
        </article>
      </main>
    </div>
  );
}

function QuoteDocument({ quote }: { quote: AdminQuoteSaved }) {
  return (
    <>
      {/* ============ Letterhead ============ */}
      <div className="flex items-start justify-between gap-6 pb-6 border-b border-brand-border print:border-black/30">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-gold print:text-black">
            Black Timber Contracting
          </h1>
          <p className="text-xs text-brand-gray print:text-black/70 mt-1">
            Cranbrook · East Kootenay · British Columbia
          </p>
          <p className="text-xs text-brand-gray print:text-black/70 mt-0.5">
            250-910-9071 · blacktimbercontracting.com
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-widest text-brand-gold print:text-black">
            Quote
          </p>
          <p className="font-mono text-base text-white print:text-black">{quote.id}</p>
          <p className="text-xs text-brand-gray print:text-black/70 mt-2">
            Issued: {fmtDate(quote.updatedAt)}
          </p>
          <p className="text-xs text-brand-gray print:text-black/70">
            Valid until: {fmtDate(quote.validUntil)}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest mt-2 text-brand-gold print:text-black">
            {quote.status}
          </p>
        </div>
      </div>

      {/* ============ Customer + project ============ */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
        <div>
          <h2 className="text-[10px] font-mono uppercase tracking-widest text-brand-gold print:text-black mb-2">
            Bill to
          </h2>
          <div className="text-sm leading-relaxed">
            <p className="font-bold">{quote.customer.name}</p>
            {quote.customer.billingAddress ? <p>{quote.customer.billingAddress}</p> : null}
            {quote.customer.email ? <p className="text-brand-gray print:text-black/70">{quote.customer.email}</p> : null}
            {quote.customer.phone ? <p className="text-brand-gray print:text-black/70">{quote.customer.phone}</p> : null}
          </div>
        </div>
        {quote.customer.jobSiteAddress ? (
          <div>
            <h2 className="text-[10px] font-mono uppercase tracking-widest text-brand-gold print:text-black mb-2">
              Job site
            </h2>
            <p className="text-sm">{quote.customer.jobSiteAddress}</p>
          </div>
        ) : null}
      </section>

      <section className="mt-6">
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-brand-gold print:text-black mb-2">
          Project
        </h2>
        <p className="text-sm leading-relaxed">
          <span className="font-mono text-xs text-brand-gray print:text-black/70 mr-2 uppercase">
            {quote.project.type}
            {quote.project.lengthFt && quote.project.widthFt
              ? ` · ${quote.project.lengthFt}ft × ${quote.project.widthFt}ft`
              : ""}
            {quote.project.material ? ` · ${quote.project.material}` : ""}
          </span>
        </p>
        <p className="text-sm leading-relaxed mt-1">{quote.project.scopeSummary}</p>
        {quote.project.notes ? (
          <p className="text-xs leading-relaxed mt-2 text-brand-gray print:text-black/70">
            {quote.project.notes}
          </p>
        ) : null}
      </section>

      {/* ============ Line items ============ */}
      <section className="mt-8">
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-brand-gold print:text-black mb-3">
          Line items
        </h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-[10px] font-mono uppercase tracking-widest text-brand-gray print:text-black/70 border-b border-brand-border print:border-black/30">
              <th className="text-left font-normal py-2 pr-2 w-8">#</th>
              <th className="text-left font-normal py-2 px-2">Description</th>
              <th className="text-right font-normal py-2 px-2 w-20">Qty</th>
              <th className="text-left font-normal py-2 px-2 w-16">UOM</th>
              <th className="text-right font-normal py-2 px-2 w-24">Unit CAD</th>
              <th className="text-right font-normal py-2 pl-2 w-28">Line total</th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((l, idx) => {
              const total = l.quantity * l.unitPriceCAD;
              return (
                <tr
                  key={l.id}
                  className="border-b border-brand-border/60 print:border-black/15 align-top"
                >
                  <td className="py-2 pr-2 text-brand-gray print:text-black/60 font-mono text-xs pt-2.5">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-2">
                    <div>{l.description}</div>
                    <div className="text-[11px] text-brand-gray print:text-black/60 font-mono mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>{SOURCE_LABEL[l.source] ?? "—"}</span>
                      {l.leadTimeDays && l.leadTimeDays > 0 ? (
                        <span>Lead time ~{l.leadTimeDays} business days</span>
                      ) : null}
                    </div>
                    {l.notes ? (
                      <div className="text-[11px] text-brand-gray print:text-black/60 italic mt-0.5">
                        {l.notes}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-2 px-2 text-right font-mono pt-2.5">{l.quantity}</td>
                  <td className="py-2 px-2 font-mono pt-2.5">{l.uom}</td>
                  <td className="py-2 px-2 text-right font-mono pt-2.5">
                    {fmtCAD(l.unitPriceCAD)}
                  </td>
                  <td className="py-2 pl-2 text-right font-mono pt-2.5 font-medium">
                    {fmtCAD(total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* ============ Totals ============ */}
      <section className="mt-6 flex justify-end">
        <dl className="grid grid-cols-2 gap-y-1.5 text-sm font-mono w-full max-w-sm">
          <dt className="text-brand-gray print:text-black/70">Subtotal</dt>
          <dd className="text-right">{fmtCAD(quote.totals.subtotalCAD)}</dd>
          <dt className="text-brand-gray print:text-black/70">Freight</dt>
          <dd className="text-right">{fmtCAD(quote.totals.freightCAD)}</dd>
          <dt className="text-brand-gray print:text-black/70">GST 5%</dt>
          <dd className="text-right">{fmtCAD(quote.totals.gstCAD)}</dd>
          {quote.totals.pstCAD > 0 ? (
            <>
              <dt className="text-brand-gray print:text-black/70">PST 7%</dt>
              <dd className="text-right">{fmtCAD(quote.totals.pstCAD)}</dd>
            </>
          ) : null}
          <dt className="text-brand-gold print:text-black uppercase tracking-widest text-xs pt-2 border-t border-brand-border print:border-black/30 mt-1">
            Grand total CAD
          </dt>
          <dd className="text-right text-brand-gold print:text-black text-base font-bold pt-2 border-t border-brand-border print:border-black/30 mt-1">
            {fmtCAD(quote.totals.grandTotalCAD)}
          </dd>
        </dl>
      </section>

      {/* ============ Tax + lead-time notes ============ */}
      <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-brand-gold print:text-black mb-2">
            Tax treatment
          </h3>
          <p className="text-xs leading-relaxed text-brand-gray print:text-black/80">
            {TAX_MODE_LABEL[quote.taxMode]}
            {quote.taxMode === "real_property_install"
              ? " — GST 5% applies; PST is paid by Black Timber at the supplier and is not invoiced separately to the customer."
              : null}
            {quote.taxMode === "supply_only"
              ? " — GST 5% and PST 7% both apply on the materials and freight portion of this quote."
              : null}
            {quote.taxMode === "mixed_split"
              ? " — This contract should be split: an installed-into-real-property portion (no PST shown) and a supply-only portion (PST 7%). Confirm split with Jaryd before signing."
              : null}
            {quote.taxMode === "exempt"
              ? " — Customer holds a valid PST exemption. GST 5% applies."
              : null}
          </p>
        </div>
        <div>
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-brand-gold print:text-black mb-2">
            Lead time
          </h3>
          <p className="text-xs leading-relaxed text-brand-gray print:text-black/80">
            {quote.totals.maxLeadTimeDays > 0
              ? `Up to ${quote.totals.maxLeadTimeDays} business days for any special-order line. Stocked items at Fernie HH PRO are usually next-day pickup.`
              : "All line items are typically stocked at Fernie HH PRO or scheduled with the existing crew. No special-order lead times anticipated."}
          </p>
        </div>
      </section>

      {/* ============ Footer fineprint ============ */}
      <footer className="mt-10 pt-4 border-t border-brand-border print:border-black/20 text-[11px] leading-relaxed text-brand-gray print:text-black/70">
        <p>
          This quote is valid until {fmtDate(quote.validUntil)}. Material pricing is based on Fernie
          Home Hardware PRO ballparks at the time of issue and is subject to desk confirmation.
          Final price requires an in-person site visit by Jaryd. Black Timber Contracting reserves
          the right to revise lines materially affected by hidden conditions discovered during work.
        </p>
        <p className="mt-2 font-mono text-[10px]">
          Quote ID {quote.id} · v{quote.updatedAt.slice(0, 19).replace("T", " ")} UTC
        </p>
      </footer>
    </>
  );
}
