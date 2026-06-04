/**
 * /admin/quotes/[id] — saved-document view, print-optimized.
 *
 * One page, three personalities. Same record drives a Quote, an Estimate, or
 * an Invoice — the document type just changes the headline, the date label,
 * which terms paragraph is rendered, and (for invoices) whether a payment-
 * instructions block + signature line + due-date watermark appears.
 *
 * Print rules:
 *   - The on-screen toolbar and any non-essential UI use `print:hidden`.
 *   - Backgrounds collapse to white, text to black, brand gold accents stay.
 *   - Letter / A4 fits with sensible margins. We avoid breaking inside the
 *     totals block by setting `break-inside: avoid` on key sections.
 *   - The logo is rendered at the natural aspect of `public/black-timber-logo.png`
 *     and contained in a fixed-height box so the letterhead doesn't bloat.
 *
 * Auth: re-verifies via `getAdminSession()` server-side before reading the
 * saved record (the proxy redirect is optimistic only).
 */

import type { Metadata } from "next";
import Image from "next/image";
import { redirect, notFound } from "next/navigation";

import { getAdminSession } from "@/lib/admin/session";
import { loadQuote } from "@/lib/admin/quotes";
import { getBusinessProfile } from "@/lib/business-config";
import type {
  AdminDocumentType,
  AdminQuoteSaved,
  AdminQuoteTaxMode,
} from "@/lib/admin/schemas";
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

/**
 * Older saved records may not carry `documentType`. Recover from the id prefix:
 *   I-... → invoice, E-... → estimate, anything else (Q- or legacy) → quote.
 */
function idToDocType(id: string): AdminDocumentType {
  const prefix = id.charAt(0).toUpperCase();
  if (prefix === "I") return "invoice";
  if (prefix === "E") return "estimate";
  return "quote";
}

function fmtCAD(n: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface DocCopy {
  /** Headline word that appears in the top-right of the letterhead. */
  headline: string;
  /** Date label in the metadata block ("Valid until" / "Payment due" / etc). */
  dateLabel: string;
  /** Footer fineprint paragraph specific to this document type. */
  footerNote: string;
  /** Whether to render an acceptance signature block. */
  showSignature: boolean;
  /** Whether to render the payment-instructions block. */
  showPayment: boolean;
}

function copyForDoc(docType: AdminDocumentType): DocCopy {
  switch (docType) {
    case "invoice":
      return {
        headline: "Invoice",
        dateLabel: "Payment due",
        footerNote:
          "Thank you for your business. Please remit payment by the due date noted above using the instructions on this invoice. " +
          "Any disputed line items must be raised in writing within 7 days of receipt; unpaid balances after the due date may be " +
          "subject to a 1.5% monthly service charge (18% APR).",
        showSignature: false,
        showPayment: true,
      };
    case "estimate":
      return {
        headline: "Estimate",
        dateLabel: "Estimate good until",
        footerNote:
          "This is a budgetary estimate based on the scope as currently understood. Final pricing is committed via a separate " +
          "Quote following an in-person site visit. Material costs reflect Fernie Home Hardware PRO ballparks at the time of " +
          "issue and are subject to desk confirmation. Hidden conditions discovered during work may revise affected lines.",
        showSignature: false,
        showPayment: false,
      };
    case "quote":
    default:
      return {
        headline: "Quote",
        dateLabel: "Valid until",
        footerNote:
          "This quote is valid until the date noted above. Material pricing is based on Fernie Home Hardware PRO ballparks at " +
          "the time of issue and is subject to desk confirmation. Final price requires an in-person site visit by Jaryd. " +
          "Black Timber Contracting reserves the right to revise lines materially affected by hidden conditions discovered during work.",
        showSignature: true,
        showPayment: false,
      };
  }
}

export default async function QuoteDetailPage({ params }: PageProps) {
  const session = await getAdminSession();
  const { id } = await params;
  if (!session) redirect(`/admin/login?from=/admin/quotes/${id}`);

  const quote = await loadQuote(id);
  if (!quote) notFound();

  // Recover doc type for legacy records that didn't persist it.
  const docType: AdminDocumentType = quote.documentType ?? idToDocType(quote.id);
  const business = getBusinessProfile();
  const copy = copyForDoc(docType);

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
              {copy.headline} {quote.id}
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

      {/* ---- The actual document (printable) ---- */}
      <main className="max-w-5xl mx-auto px-6 py-10 print:px-0 print:py-0">
        <article
          className="
            relative bg-white text-black rounded-xl
            shadow-2xl shadow-black/40 print:shadow-none
            border border-brand-border print:border-0
            print:rounded-none
            mx-auto
          "
          style={{ minHeight: "1100px" }}
        >
          {/* Doc-type accent stripe down the left edge — also a nice visual */}
          {/* anchor when printed. */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1.5 print:bg-[#a98a4a]"
            style={{ background: "#a98a4a" }}
          />
          <div className="px-12 py-12 print:px-12 print:py-10">
            <Letterhead
              business={business}
              quote={quote}
              docType={docType}
              copy={copy}
            />
            <Parties quote={quote} business={business} />
            <ProjectBlock quote={quote} />
            <LinesTable quote={quote} />
            <TotalsAndNotes quote={quote} />
            {copy.showPayment ? (
              <PaymentBlock quote={quote} business={business} />
            ) : null}
            {copy.showSignature ? <SignatureBlock /> : null}
            <Footer quote={quote} business={business} copy={copy} />
          </div>
        </article>
      </main>
    </div>
  );
}

// =============================================================================
// Letterhead — logo, business identity, document title block.
// =============================================================================

function Letterhead({
  business,
  quote,
  docType,
  copy,
}: {
  business: ReturnType<typeof getBusinessProfile>;
  quote: AdminQuoteSaved;
  docType: AdminDocumentType;
  copy: DocCopy;
}) {
  const statusBadge = statusLabel(quote.status, docType);
  return (
    <header className="flex items-start justify-between gap-8 pb-6 border-b-2 border-black/10">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 shrink-0 relative">
          <Image
            src="/black-timber-logo.png"
            alt={`${business.name} logo`}
            fill
            sizes="64px"
            style={{ objectFit: "contain" }}
            priority
          />
        </div>
        <div>
          <h1
            className="text-[22px] font-extrabold tracking-tight leading-none"
            style={{ color: "#0a0a0a" }}
          >
            {business.name}
          </h1>
          <p className="text-[11px] text-black/70 mt-1.5 leading-snug">
            {business.region}
          </p>
          <p className="text-[11px] text-black/70 leading-snug">
            {business.phone} · {business.email} · {business.domain}
          </p>
          {business.gstNumber || business.wcbNumber || business.licenseNumber ? (
            <p className="text-[10px] text-black/60 mt-1 font-mono">
              {business.gstNumber ? `GST# ${business.gstNumber}` : null}
              {business.gstNumber && business.wcbNumber ? "  ·  " : ""}
              {business.wcbNumber ? `WCB ${business.wcbNumber}` : null}
              {(business.gstNumber || business.wcbNumber) && business.licenseNumber
                ? "  ·  "
                : ""}
              {business.licenseNumber ? `License ${business.licenseNumber}` : null}
            </p>
          ) : null}
        </div>
      </div>

      <div className="text-right shrink-0">
        <p
          className="font-mono text-[11px] uppercase tracking-[0.3em] text-black/50"
        >
          {copy.headline}
        </p>
        <p
          className="font-mono text-[20px] font-semibold mt-0.5"
          style={{ color: "#0a0a0a" }}
        >
          {quote.id}
        </p>
        <dl className="mt-3 text-[11px] grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 justify-end ml-auto">
          <dt className="text-black/60 text-right">Issued</dt>
          <dd className="font-mono text-right">{fmtDate(quote.updatedAt)}</dd>
          <dt className="text-black/60 text-right">{copy.dateLabel}</dt>
          <dd className="font-mono text-right">{fmtDate(quote.validUntil)}</dd>
        </dl>
        <span
          className="inline-block mt-3 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-widest border"
          style={{ borderColor: "#a98a4a", color: "#a98a4a" }}
        >
          {statusBadge}
        </span>
      </div>
    </header>
  );
}

function statusLabel(status: string, docType: AdminDocumentType): string {
  // Re-label statuses that don't read the same across doc types — e.g., a
  // "sent" invoice reads better as "Issued" on the printed page.
  if (docType === "invoice") {
    if (status === "sent") return "Issued";
    if (status === "paid") return "Paid";
  }
  return status;
}

// =============================================================================
// Bill-to + Job-site
// =============================================================================

function Parties({
  quote,
  business,
}: {
  quote: AdminQuoteSaved;
  business: ReturnType<typeof getBusinessProfile>;
}) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 gap-8 mt-7">
      <div>
        <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-black/60 mb-2">
          Bill to
        </h2>
        <p className="text-sm font-bold leading-snug">{quote.customer.name}</p>
        {quote.customer.billingAddress ? (
          <p className="text-sm text-black/80 leading-snug whitespace-pre-line">
            {quote.customer.billingAddress}
          </p>
        ) : null}
        <div className="text-[12px] text-black/70 mt-1 space-y-0.5">
          {quote.customer.email ? <p>{quote.customer.email}</p> : null}
          {quote.customer.phone ? <p>{quote.customer.phone}</p> : null}
        </div>
      </div>
      <div>
        <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-black/60 mb-2">
          Job site
        </h2>
        {quote.customer.jobSiteAddress ? (
          <p className="text-sm leading-snug whitespace-pre-line">
            {quote.customer.jobSiteAddress}
          </p>
        ) : (
          <p className="text-sm text-black/60 italic">Same as billing address</p>
        )}
        {business.address ? (
          <>
            <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-black/60 mt-4 mb-2">
              Remit to
            </h2>
            <p className="text-sm text-black/80 leading-snug whitespace-pre-line">
              {business.address.replace(/\\n/g, "\n")}
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}

// =============================================================================
// Project scope
// =============================================================================

function ProjectBlock({ quote }: { quote: AdminQuoteSaved }) {
  const dims =
    quote.project.lengthFt && quote.project.widthFt
      ? `${quote.project.lengthFt}ft × ${quote.project.widthFt}ft`
      : null;
  return (
    <section className="mt-7 break-inside-avoid">
      <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-black/60 mb-2">
        Project
      </h2>
      <p className="font-mono text-[11px] uppercase tracking-widest text-black/60">
        {quote.project.type.replace("_", " ")}
        {dims ? ` · ${dims}` : ""}
        {quote.project.material ? ` · ${quote.project.material}` : ""}
      </p>
      <p className="text-sm leading-relaxed mt-2 whitespace-pre-line">
        {quote.project.scopeSummary}
      </p>
      {quote.project.notes ? (
        <p className="text-[12px] leading-relaxed mt-2 text-black/70 whitespace-pre-line">
          {quote.project.notes}
        </p>
      ) : null}
    </section>
  );
}

// =============================================================================
// Line items
// =============================================================================

function LinesTable({ quote }: { quote: AdminQuoteSaved }) {
  return (
    <section className="mt-8">
      <table className="w-full text-[12.5px] border-collapse">
        <thead>
          <tr
            className="text-[10px] font-mono uppercase tracking-[0.2em] text-white"
            style={{ background: "#0a0a0a" }}
          >
            <th className="text-left font-medium py-2.5 pl-3 pr-2 w-8">#</th>
            <th className="text-left font-medium py-2.5 px-2">Description</th>
            <th className="text-right font-medium py-2.5 px-2 w-16">Qty</th>
            <th className="text-left font-medium py-2.5 px-2 w-12">UOM</th>
            <th className="text-right font-medium py-2.5 px-2 w-24">Unit CAD</th>
            <th className="text-right font-medium py-2.5 pl-2 pr-3 w-28">Line total</th>
          </tr>
        </thead>
        <tbody>
          {quote.lines.map((l, idx) => {
            const total = l.quantity * l.unitPriceCAD;
            return (
              <tr
                key={l.id}
                className="border-b border-black/10 align-top"
                style={idx % 2 === 1 ? { background: "#fafaf7" } : undefined}
              >
                <td className="py-2 pl-3 pr-2 text-black/50 font-mono text-[11px] pt-3">
                  {idx + 1}
                </td>
                <td className="py-2 px-2">
                  <div className="text-sm leading-snug">{l.description}</div>
                  <div className="text-[10.5px] text-black/55 font-mono mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>{SOURCE_LABEL[l.source] ?? "—"}</span>
                    {l.leadTimeDays && l.leadTimeDays > 0 ? (
                      <span>Lead time ~{l.leadTimeDays} business days</span>
                    ) : null}
                  </div>
                  {l.notes ? (
                    <div className="text-[11px] text-black/65 italic mt-0.5">
                      {l.notes}
                    </div>
                  ) : null}
                </td>
                <td className="py-2 px-2 text-right font-mono pt-3">{l.quantity}</td>
                <td className="py-2 px-2 font-mono pt-3 text-black/70">{l.uom}</td>
                <td className="py-2 px-2 text-right font-mono pt-3">
                  {fmtCAD(l.unitPriceCAD)}
                </td>
                <td className="py-2 pl-2 pr-3 text-right font-mono pt-3 font-medium">
                  {fmtCAD(total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

// =============================================================================
// Totals + tax/lead-time notes
// =============================================================================

function TotalsAndNotes({ quote }: { quote: AdminQuoteSaved }) {
  return (
    <section className="mt-7 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-8 break-inside-avoid">
      <div className="space-y-5">
        <div>
          <h3 className="text-[10px] font-mono uppercase tracking-[0.3em] text-black/60 mb-1.5">
            Tax treatment
          </h3>
          <p className="text-[11.5px] leading-relaxed text-black/80">
            {TAX_MODE_LABEL[quote.taxMode]}
            {quote.taxMode === "real_property_install"
              ? " — GST 5% applies; PST is paid by Black Timber at the supplier and is not invoiced separately to the customer."
              : null}
            {quote.taxMode === "supply_only"
              ? " — GST 5% and PST 7% both apply on the materials and freight portion of this document."
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
          <h3 className="text-[10px] font-mono uppercase tracking-[0.3em] text-black/60 mb-1.5">
            Lead time
          </h3>
          <p className="text-[11.5px] leading-relaxed text-black/80">
            {quote.totals.maxLeadTimeDays > 0
              ? `Up to ${quote.totals.maxLeadTimeDays} business days for any special-order line. Stocked items at Fernie HH PRO are usually next-day pickup.`
              : "All line items are typically stocked at Fernie HH PRO or scheduled with the existing crew. No special-order lead times anticipated."}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-[12.5px] font-mono w-full max-w-xs self-start">
        <dt className="text-black/65">Subtotal</dt>
        <dd className="text-right">{fmtCAD(quote.totals.subtotalCAD)}</dd>
        <dt className="text-black/65">Freight</dt>
        <dd className="text-right">{fmtCAD(quote.totals.freightCAD)}</dd>
        <dt className="text-black/65">GST 5%</dt>
        <dd className="text-right">{fmtCAD(quote.totals.gstCAD)}</dd>
        {quote.totals.pstCAD > 0 ? (
          <>
            <dt className="text-black/65">PST 7%</dt>
            <dd className="text-right">{fmtCAD(quote.totals.pstCAD)}</dd>
          </>
        ) : null}
        <dt
          className="text-[12px] uppercase tracking-[0.2em] pt-2 border-t border-black/40 mt-1 font-bold"
          style={{ color: "#0a0a0a" }}
        >
          Total CAD
        </dt>
        <dd
          className="text-right text-[15px] font-bold pt-2 border-t border-black/40 mt-1"
          style={{ color: "#0a0a0a" }}
        >
          {fmtCAD(quote.totals.grandTotalCAD)}
        </dd>
      </dl>
    </section>
  );
}

// =============================================================================
// Payment instructions block (invoices only)
// =============================================================================

function PaymentBlock({
  quote,
  business,
}: {
  quote: AdminQuoteSaved;
  business: ReturnType<typeof getBusinessProfile>;
}) {
  // Synthesize a sensible instruction block when the user didn't fill one in.
  const fallbackInstructions = [
    business.eTransferEmail
      ? `E-transfer to ${business.eTransferEmail} (no password required if auto-deposit; otherwise password "blacktimber")`
      : null,
    `Cheques payable to ${business.legalName}`,
    business.address
      ? `Mail to:\n${business.address.replace(/\\n/g, "\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const instructions =
    quote.paymentInstructions?.trim() || fallbackInstructions;

  return (
    <section
      className="mt-8 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-8 p-5 rounded-md break-inside-avoid"
      style={{ background: "#faf6ec", border: "1px solid #e8dcb8" }}
    >
      <div>
        <h3 className="text-[10px] font-mono uppercase tracking-[0.3em] text-black/60 mb-2">
          Payment terms
        </h3>
        <p className="text-sm font-semibold">
          {quote.paymentTerms?.trim() || "Net 14"}
        </p>
        <p className="text-[11px] text-black/65 mt-0.5">
          Due {fmtDate(quote.validUntil)}
        </p>
      </div>
      <div>
        <h3 className="text-[10px] font-mono uppercase tracking-[0.3em] text-black/60 mb-2">
          Payment instructions
        </h3>
        <p className="text-[12.5px] leading-relaxed whitespace-pre-line">
          {instructions}
        </p>
      </div>
    </section>
  );
}

// =============================================================================
// Signature block (quotes only)
// =============================================================================

function SignatureBlock() {
  return (
    <section className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-8 break-inside-avoid">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-black/60 mb-8">
          Accepted by (customer)
        </p>
        <div className="border-t border-black/40 pt-1">
          <p className="text-[10px] text-black/55">Signature</p>
        </div>
        <div className="border-t border-black/40 mt-6 pt-1">
          <p className="text-[10px] text-black/55">Print name</p>
        </div>
        <div className="border-t border-black/40 mt-6 pt-1">
          <p className="text-[10px] text-black/55">Date</p>
        </div>
      </div>
      <div>
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-black/60 mb-8">
          Black Timber Contracting
        </p>
        <div className="border-t border-black/40 pt-1">
          <p className="text-[10px] text-black/55">Authorized signature</p>
        </div>
        <div className="border-t border-black/40 mt-6 pt-1">
          <p className="text-[10px] text-black/55">Jaryd · Founder</p>
        </div>
        <div className="border-t border-black/40 mt-6 pt-1">
          <p className="text-[10px] text-black/55">Date</p>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// Footer
// =============================================================================

function Footer({
  quote,
  business,
  copy,
}: {
  quote: AdminQuoteSaved;
  business: ReturnType<typeof getBusinessProfile>;
  copy: DocCopy;
}) {
  return (
    <footer className="mt-10 pt-4 border-t border-black/15 text-[11px] leading-relaxed text-black/70">
      <p>{copy.footerNote}</p>
      <p className="mt-2 font-mono text-[10px] text-black/55">
        {copy.headline} ID {quote.id} · {business.legalName} ·
        {" v"}
        {quote.updatedAt.slice(0, 19).replace("T", " ")} UTC
      </p>
    </footer>
  );
}
