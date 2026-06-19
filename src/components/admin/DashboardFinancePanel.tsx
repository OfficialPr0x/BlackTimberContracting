"use client";

/**
 * Interactive invoice finance panel for the admin dashboard.
 *
 * Headline figures (invoiced / deposits collected / outstanding owing) animate
 * up on mount, a stacked bar visualizes collection progress, and a tab switcher
 * flips between open balances and recent deposits. Pure data is computed
 * server-side in getInvoiceFinanceSummary(); this component only presents it.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  ChevronRight,
  CreditCard,
  ReceiptText,
  Smartphone,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { PAYMENT_METHOD_LABELS, type InvoicePaymentMethod } from "@/lib/admin/schemas";
import type { InvoiceFinanceSummary } from "@/lib/admin/invoice-payments";

const METHOD_ICONS: Record<InvoicePaymentMethod, typeof Banknote> = {
  cash: Banknote,
  e_transfer: Smartphone,
  credit_card: CreditCard,
};

function fmtCAD(n: number, fractionDigits = 2): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

function fmtDate(d?: string | null): string | null {
  if (!d) return null;
  const parsed = new Date(`${d}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

/** Count up to `value` over ~700ms with an ease-out curve. */
function useCountUp(value: number, durationMs = 700): number {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);
  return display;
}

function AnimatedCAD({ value }: { value: number }) {
  const n = useCountUp(value);
  return <>{fmtCAD(n)}</>;
}

type Tab = "outstanding" | "deposits";

export default function DashboardFinancePanel({ summary }: { summary: InvoiceFinanceSummary }) {
  const [tab, setTab] = useState<Tab>(summary.outstandingCAD > 0 ? "outstanding" : "deposits");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const ratePct = Math.round(summary.collectionRate * 100);

  if (summary.invoiceCount === 0) {
    return (
      <section className="rounded-2xl border border-brand-border bg-brand-panel/60 p-6">
        <div className="flex items-center gap-2 mb-1">
          <ReceiptText className="w-4 h-4 text-brand-gold" />
          <h2 className="text-sm font-medium text-white">Invoice finances</h2>
        </div>
        <p className="text-sm text-brand-gray">
          No invoices yet. Create one in the{" "}
          <Link href="/admin/quotes?convert=invoice" className="text-brand-gold hover:underline">
            builder
          </Link>{" "}
          to start tracking deposits and outstanding balances here.
        </p>
      </section>
    );
  }

  const outstandingRows = overdueOnly
    ? summary.outstanding.filter((r) => r.overdue)
    : summary.outstanding;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-brand-gray">
          Invoice finances
        </h2>
        <Link
          href="/admin/quotes"
          className="text-[10px] font-mono uppercase tracking-widest text-brand-gold hover:underline"
        >
          All invoices
        </Link>
      </div>

      {/* Headline figures */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MoneyCard
          icon={ReceiptText}
          tone="neutral"
          label="Total invoiced"
          value={<AnimatedCAD value={summary.totalInvoicedCAD} />}
          sub={`${summary.invoiceCount} invoice${summary.invoiceCount === 1 ? "" : "s"}`}
        />
        <MoneyCard
          icon={Wallet}
          tone="gold"
          label="Deposits collected"
          value={<AnimatedCAD value={summary.totalCollectedCAD} />}
          sub={`${ratePct}% of invoiced · ${summary.paidCount} paid in full`}
        />
        <MoneyCard
          icon={TrendingUp}
          tone="amber"
          label="Outstanding owing"
          value={<AnimatedCAD value={summary.outstandingCAD} />}
          sub={
            summary.overdueCount > 0
              ? `${summary.overdueCount} overdue · ${fmtCAD(summary.overdueAmountCAD, 0)}`
              : `${summary.partialCount + summary.unpaidCount} open`
          }
        />
      </div>

      {/* Collection progress bar */}
      <div className="rounded-2xl border border-brand-border bg-brand-panel/50 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-brand-gray">
            Collection progress
          </span>
          <span className="text-xs font-mono text-brand-gold">{ratePct}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-brand-charcoal overflow-hidden flex">
          <div
            className="h-full bg-brand-gold transition-[width] duration-700 ease-out"
            style={{ width: `${ratePct}%` }}
          />
          <div
            className="h-full bg-amber-500/50 transition-[width] duration-700 ease-out"
            style={{ width: `${100 - ratePct}%` }}
          />
        </div>
        <div className="flex items-center gap-4 mt-2.5 text-[11px] text-brand-gray">
          <Legend className="bg-brand-gold" label={`Collected ${fmtCAD(summary.appliedCollectedCAD, 0)}`} />
          <Legend className="bg-amber-500/50" label={`Owing ${fmtCAD(summary.outstandingCAD, 0)}`} />
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-2xl border border-brand-border overflow-hidden">
        <div className="flex items-center justify-between border-b border-brand-border bg-brand-charcoal/40">
          <div className="flex">
            <TabButton active={tab === "outstanding"} onClick={() => setTab("outstanding")}>
              Outstanding ({summary.outstanding.length})
            </TabButton>
            <TabButton active={tab === "deposits"} onClick={() => setTab("deposits")}>
              Recent deposits ({summary.recentDeposits.length})
            </TabButton>
          </div>
          {tab === "outstanding" && summary.overdueCount > 0 ? (
            <button
              onClick={() => setOverdueOnly((v) => !v)}
              className={`mr-2 my-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider transition-colors ${
                overdueOnly
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "text-brand-gray border border-brand-border hover:text-amber-300"
              }`}
            >
              Overdue only
            </button>
          ) : null}
        </div>

        {tab === "outstanding" ? (
          outstandingRows.length === 0 ? (
            <EmptyRow text={overdueOnly ? "Nothing overdue. " : "All invoices are fully paid. "} />
          ) : (
            <ul className="divide-y divide-brand-border">
              {outstandingRows.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/admin/quotes/${encodeURIComponent(r.id)}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-brand-charcoal/50 transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-brand-gold">{r.id}</span>
                        {r.overdue ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded px-1.5 py-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" /> Overdue
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-white truncate">{r.customerName}</p>
                      <p className="text-[11px] text-brand-gray">
                        {fmtCAD(r.paidCAD, 0)} of {fmtCAD(r.grandTotalCAD, 0)} paid
                        {r.dueDate ? ` · due ${fmtDate(r.dueDate)}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono text-white">{fmtCAD(r.balanceCAD)}</p>
                      <p className="text-[10px] text-brand-gray uppercase tracking-wider">owing</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-brand-gray group-hover:text-brand-gold transition-colors shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : summary.recentDeposits.length === 0 ? (
          <EmptyRow text="No deposits recorded yet. " />
        ) : (
          <ul className="divide-y divide-brand-border">
            {summary.recentDeposits.map((d) => {
              const Icon = METHOD_ICONS[d.method];
              return (
                <li key={d.paymentId}>
                  <Link
                    href={`/admin/quotes/${encodeURIComponent(d.documentId)}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-brand-charcoal/50 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{d.customerName}</p>
                      <p className="text-[11px] text-brand-gray">
                        {PAYMENT_METHOD_LABELS[d.method]} · {fmtDate(d.paidAt)} ·{" "}
                        <span className="font-mono text-brand-gold/80">{d.documentId}</span>
                      </p>
                    </div>
                    <p className="text-sm font-mono text-emerald-400 shrink-0">+{fmtCAD(d.amountCAD)}</p>
                    <ChevronRight className="w-4 h-4 text-brand-gray group-hover:text-brand-gold transition-colors shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function MoneyCard({
  icon: Icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: typeof Wallet;
  tone: "neutral" | "gold" | "amber";
  label: string;
  value: React.ReactNode;
  sub: string;
}) {
  const toneCls =
    tone === "gold"
      ? "border-brand-gold/40 bg-brand-gold/[0.06]"
      : tone === "amber"
        ? "border-amber-500/40 bg-amber-500/[0.05]"
        : "border-brand-border bg-brand-panel/80";
  const iconCls =
    tone === "gold" ? "text-brand-gold" : tone === "amber" ? "text-amber-400" : "text-brand-gray";
  return (
    <div className={`rounded-2xl border p-4 ${toneCls}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono uppercase tracking-widest text-brand-gray">{label}</p>
        <Icon className={`w-4 h-4 ${iconCls}`} />
      </div>
      <p className="mt-2 text-xl sm:text-2xl font-medium text-white tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] text-brand-gray">{sub}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-[11px] font-mono uppercase tracking-wider transition-colors border-b-2 -mb-px ${
        active
          ? "border-brand-gold text-brand-gold"
          : "border-transparent text-brand-gray hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-4 py-6 text-sm text-brand-gray">{text}</p>;
}
