"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, CreditCard, Loader, Plus, Smartphone, Trash2 } from "lucide-react";
import {
  InvoicePaymentMethod,
  PAYMENT_METHOD_LABELS,
  type InvoicePaymentSummary,
} from "@/lib/admin/schemas";

const METHOD_ICONS: Record<InvoicePaymentMethod, typeof Banknote> = {
  cash: Banknote,
  e_transfer: Smartphone,
  credit_card: CreditCard,
};

function fmtCAD(n: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(n);
}

const inputCls =
  "w-full rounded-md bg-brand-charcoal border border-brand-border focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/40 outline-none px-2.5 py-1.5 text-sm text-white";

interface InvoicePaymentTrackerProps {
  invoiceId: string;
  grandTotalCAD: number;
  onStatusChange?: (status: "paid" | "sent" | "draft") => void;
  onSummaryChange?: (summary: InvoicePaymentSummary) => void;
}

export default function InvoicePaymentTracker({
  invoiceId,
  grandTotalCAD,
  onStatusChange,
  onSummaryChange,
}: InvoicePaymentTrackerProps) {
  const [summary, setSummary] = useState<InvoicePaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<InvoicePaymentMethod>("e_transfer");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/quotes/${encodeURIComponent(invoiceId)}/payments`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not load payments");
      const next = body as InvoicePaymentSummary;
      setSummary(next);
      onSummaryChange?.(next);
      if (body.balanceDueCAD <= 0.005 && onStatusChange) {
        onStatusChange("paid");
      } else if (body.totalPaidCAD > 0 && onStatusChange) {
        onStatusChange("sent");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [invoiceId, onStatusChange, onSummaryChange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const recordPayment = async () => {
    const amountCAD = Number(amount);
    if (!Number.isFinite(amountCAD) || amountCAD <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/quotes/${encodeURIComponent(invoiceId)}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCAD,
          method,
          paidAt,
          notes: notes.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not record payment");
      const next = body as InvoicePaymentSummary;
      setSummary(next);
      onSummaryChange?.(next);
      setAmount("");
      setNotes("");
      if (body.balanceDueCAD <= 0.005 && onStatusChange) onStatusChange("paid");
      else if (onStatusChange) onStatusChange("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const removePayment = async (paymentId: string) => {
    if (!confirm("Remove this payment entry?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/quotes/${encodeURIComponent(invoiceId)}/payments/${encodeURIComponent(paymentId)}`,
        { method: "DELETE" }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not remove payment");
      const next = body as InvoicePaymentSummary;
      setSummary(next);
      onSummaryChange?.(next);
      if (body.balanceDueCAD <= 0.005 && onStatusChange) onStatusChange("paid");
      else if (body.totalPaidCAD > 0 && onStatusChange) onStatusChange("sent");
      else if (onStatusChange) onStatusChange("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  const balance = summary?.balanceDueCAD ?? grandTotalCAD;
  const paid = summary?.totalPaidCAD ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border border-brand-border bg-brand-charcoal/40 px-3 py-2">
          <p className="text-[9px] font-mono uppercase tracking-widest text-brand-gray">Invoice total</p>
          <p className="text-sm font-mono text-white mt-0.5">{fmtCAD(grandTotalCAD)}</p>
        </div>
        <div className="rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-3 py-2">
          <p className="text-[9px] font-mono uppercase tracking-widest text-brand-gold">Paid</p>
          <p className="text-sm font-mono text-brand-gold mt-0.5">{fmtCAD(paid)}</p>
        </div>
        <div
          className={`rounded-lg border px-3 py-2 ${
            balance <= 0.005
              ? "border-emerald-500/40 bg-emerald-500/10"
              : "border-brand-border bg-brand-charcoal/40"
          }`}
        >
          <p className="text-[9px] font-mono uppercase tracking-widest text-brand-gray">Balance due</p>
          <p
            className={`text-sm font-mono mt-0.5 ${
              balance <= 0.005 ? "text-emerald-300" : "text-white"
            }`}
          >
            {balance <= 0.005 ? "Paid in full" : fmtCAD(balance)}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-brand-gray font-mono flex items-center gap-2">
          <Loader className="w-3.5 h-3.5 animate-spin" /> Loading payments…
        </p>
      ) : null}

      {summary && summary.payments.length > 0 ? (
        <div className="border border-brand-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-brand-charcoal/60 text-[9px] font-mono uppercase tracking-widest text-brand-gray">
                <th className="text-left py-2 px-3">Date</th>
                <th className="text-left py-2 px-2">Method</th>
                <th className="text-right py-2 px-2">Amount</th>
                <th className="text-left py-2 px-2 hidden sm:table-cell">Notes</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/60">
              {summary.payments.map((p) => {
                const Icon = METHOD_ICONS[p.method];
                return (
                  <tr key={p.id} className="text-brand-gray hover:bg-brand-charcoal/30">
                    <td className="py-2 px-3 font-mono text-white">{p.paidAt}</td>
                    <td className="py-2 px-2">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5 text-brand-gold" />
                        {PAYMENT_METHOD_LABELS[p.method]}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-brand-gold">
                      {fmtCAD(p.amountCAD)}
                    </td>
                    <td className="py-2 px-2 hidden sm:table-cell truncate max-w-[140px]">
                      {p.notes ?? "—"}
                    </td>
                    <td className="py-2 pr-2">
                      <button
                        type="button"
                        onClick={() => void removePayment(p.id)}
                        disabled={saving}
                        className="p-1 rounded text-brand-gray hover:text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                        title="Remove payment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : !loading ? (
        <p className="text-xs text-brand-gray">No payments recorded yet.</p>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border border-brand-border bg-brand-black/40">
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-widest text-brand-gray">Amount (CAD)</span>
          <input
            type="number"
            min={0.01}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={balance > 0 ? balance.toFixed(2) : "0.00"}
            className={`${inputCls} font-mono mt-1`}
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-widest text-brand-gray">Method</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as InvoicePaymentMethod)}
            className={`${inputCls} mt-1`}
          >
            {(Object.keys(PAYMENT_METHOD_LABELS) as InvoicePaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-widest text-brand-gray">Payment date</span>
          <input
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            className={`${inputCls} font-mono mt-1`}
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-widest text-brand-gray">Notes (optional)</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ref #, deposit, etc."
            className={`${inputCls} mt-1`}
          />
        </label>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void recordPayment()}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-gold/20 border border-brand-gold/50 text-brand-gold text-xs font-mono uppercase tracking-widest hover:bg-brand-gold/30 disabled:opacity-50"
          >
            {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Record payment
          </button>
          {balance > 0.005 ? (
            <button
              type="button"
              onClick={() => setAmount(balance.toFixed(2))}
              className="px-3 py-2 rounded-lg border border-brand-border text-[10px] font-mono uppercase tracking-widest text-brand-gray hover:text-brand-gold"
            >
              Fill balance ({fmtCAD(balance)})
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-xs text-red-300">{error}</p> : null}

      <p className="text-[10px] text-brand-gray font-mono">
        Status auto-updates to <strong className="text-brand-gold">paid</strong> when the balance reaches $0.
        Run <code className="text-brand-gold/80">supabase/invoice-payments-schema.sql</code> once in Supabase.
      </p>
    </div>
  );
}
