"use client";

/**
 * Email a saved quote / estimate / invoice to the customer.
 *
 * The branded document is already rendered on the page (the same element the
 * "Download PDF" button uses). On send we rasterize it to a base64 PDF in the
 * browser and POST it to /api/admin/quotes/[id]/send, which mails it from
 * jaryd@blacktimber.ca and marks the document sent.
 */

import { useState } from "react";
import { CheckCircle2, Loader2, Mail, Send, X } from "lucide-react";
import { generateDocumentPdfBase64FromPage } from "@/lib/pdf/download-document-pdf";
import { documentPdfFilename } from "@/lib/pdf/filename";
import type { AdminDocumentType, AdminQuoteSaved } from "@/lib/admin/schemas";

interface SendDocumentDialogProps {
  quote: AdminQuoteSaved;
  businessName: string;
  onClose: () => void;
  onSent: (status: AdminQuoteSaved["status"]) => void;
}

function fmtCAD(n: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(d?: string): string | null {
  if (!d) return null;
  const parsed = new Date(`${d}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

const NOUNS: Record<AdminDocumentType, string> = {
  quote: "quote",
  estimate: "estimate",
  invoice: "invoice",
};

function defaultSubject(quote: AdminQuoteSaved, businessName: string): string {
  const docType = (quote.documentType ?? "quote") as AdminDocumentType;
  if (docType === "invoice") return `Invoice ${quote.id} from ${businessName}`;
  return `Your ${NOUNS[docType]} from ${businessName} (${quote.id})`;
}

function defaultMessage(quote: AdminQuoteSaved): string {
  const docType = (quote.documentType ?? "quote") as AdminDocumentType;
  const firstName = quote.customer.name.trim().split(/\s+/)[0] || "there";
  const total = fmtCAD(quote.totals.grandTotalCAD);
  if (docType === "invoice") {
    const due = fmtDate(quote.validUntil);
    return [
      `Hi ${firstName},`,
      "",
      `Please find your invoice (${quote.id}) attached as a PDF. The balance due is ${total}${
        due ? `, payable by ${due}` : ""
      }.`,
      "",
      "Let me know if you have any questions — happy to help.",
    ].join("\n");
  }
  const noun = NOUNS[docType];
  const valid = fmtDate(quote.validUntil);
  return [
    `Hi ${firstName},`,
    "",
    `Thanks for the opportunity. Your ${noun} (${quote.id}) is attached as a PDF, with a total of ${total}${
      valid ? `. This ${noun} is valid until ${valid}` : ""
    }.`,
    "",
    "If anything looks off or you'd like to adjust the scope, just reply to this email or give me a call.",
  ].join("\n");
}

function splitAddresses(value: string): string[] {
  return value
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function SendDocumentDialog({
  quote,
  businessName,
  onClose,
  onSent,
}: SendDocumentDialogProps) {
  const [to, setTo] = useState(quote.customer.email ?? "");
  const [cc, setCc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState(() => defaultSubject(quote, businessName));
  const [message, setMessage] = useState(() => defaultMessage(quote));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ to: string[]; via: string } | null>(null);

  const docNoun = NOUNS[(quote.documentType ?? "quote") as AdminDocumentType];

  async function handleSend() {
    const toList = splitAddresses(to);
    if (toList.length === 0) {
      setError("Add the customer's email address.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const filename = documentPdfFilename({
        id: quote.id,
        documentType: quote.documentType,
        customerName: quote.customer.name,
      });
      const { base64, filename: pdfName } = await generateDocumentPdfBase64FromPage(filename);

      const res = await fetch(`/api/admin/quotes/${encodeURIComponent(quote.id)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: toList,
          cc: showCc ? splitAddresses(cc) : undefined,
          subject,
          message,
          pdfBase64: base64,
          filename: pdfName,
          markSent: true,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error?.message ?? `Send failed (${res.status})`);
      }
      setSent({ to: body.to ?? toList, via: body.via ?? "inbox" });
      onSent((body.status as AdminQuoteSaved["status"]) ?? quote.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full sm:max-w-xl bg-brand-charcoal border border-brand-border sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border">
          <h2 className="text-sm font-medium text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-brand-gold" />
            Email {docNoun} to customer
          </h2>
          <button onClick={onClose} className="p-1.5 text-brand-gray hover:text-white" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {sent ? (
          <div className="px-6 py-10 flex flex-col items-center text-center gap-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            <p className="text-sm text-white font-medium">
              {quote.id} sent to {sent.to.join(", ")}
            </p>
            <p className="text-xs text-brand-gray">
              Sent from {process.env.NEXT_PUBLIC_EMAIL_DOMAIN ? `jaryd@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN}` : "jaryd@blacktimber.ca"}
              {sent.via === "inbox" ? " · saved to your Sent folder" : ""}. The document is now marked as sent.
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 rounded-lg bg-brand-gold text-brand-black text-sm font-medium hover:bg-brand-gold-hover"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-brand-gray">
                From: {businessName} &lt;jaryd@blacktimber.ca&gt;
              </div>

              <Field label="To">
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="customer@example.com"
                  className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-brand-gray/60"
                />
                {!showCc && (
                  <button
                    onClick={() => setShowCc(true)}
                    className="text-[11px] text-brand-gray hover:text-brand-gold"
                  >
                    Cc
                  </button>
                )}
              </Field>

              {showCc && (
                <Field label="Cc">
                  <input
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    placeholder="cc@example.com"
                    className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-brand-gray/60"
                  />
                </Field>
              )}

              <Field label="Subject">
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-brand-gray/60"
                />
              </Field>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={9}
                placeholder="Write a short note…"
                className="w-full bg-brand-panel/50 border border-brand-border rounded-lg p-3 text-sm text-white placeholder:text-brand-gray/60 outline-none focus:border-brand-gold/40 resize-y"
              />

              <div className="flex items-center gap-2 text-[11px] text-brand-gray">
                <Mail className="w-3.5 h-3.5 text-brand-gold" />
                The branded PDF of {quote.id} is attached automatically.
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>

            <div className="flex items-center justify-end px-4 py-3 border-t border-brand-border">
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-gold text-brand-black text-sm font-medium hover:bg-brand-gold-hover disabled:opacity-60"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? "Sending…" : "Send email"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-brand-border/60 pb-1.5">
      <span className="text-[11px] font-mono uppercase tracking-wider text-brand-gray w-14 shrink-0">
        {label}
      </span>
      {children}
    </div>
  );
}
