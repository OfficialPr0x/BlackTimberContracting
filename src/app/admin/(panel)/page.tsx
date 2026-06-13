import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, AlertCircle } from "lucide-react";
import { listQuotes } from "@/lib/admin/quotes";
import { getSupabaseConfigStatus } from "@/lib/supabase/server";
import { ADMIN_NAV } from "@/lib/admin/nav";
import { getBusinessProfile } from "@/lib/business-config";

export const metadata: Metadata = {
  title: "Dashboard · Black Timber Admin",
  robots: { index: false, follow: false },
};

function fmtCAD(n: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function AdminDashboardPage() {
  const business = getBusinessProfile();
  const storage = getSupabaseConfigStatus();
  let recentQuotes: Awaited<ReturnType<typeof listQuotes>> = [];
  try {
    recentQuotes = await listQuotes(8);
  } catch {
    recentQuotes = [];
  }

  const pipeline = recentQuotes.reduce((s, q) => s + q.totals.grandTotalCAD, 0);
  const drafts = recentQuotes.filter((q) => q.status === "draft").length;

  const tools = ADMIN_NAV.filter((n) => n.href !== "/admin");

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brand-gold">
          Dashboard
        </p>
        <h1 className="text-2xl sm:text-3xl font-medium text-white mt-1 tracking-tight">
          {business.name}
        </h1>
        <p className="text-sm text-brand-gray mt-1">{business.region}</p>
      </header>

      {!storage.ok ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-100/90">
            <p className="font-medium text-amber-200">Database not fully connected</p>
            <p className="text-xs mt-1">
              Quotes, bookkeeper context, and saves work best after Supabase is configured.
            </p>
          </div>
        </div>
      ) : null}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Recent docs" value={String(recentQuotes.length)} />
        <StatCard label="Drafts" value={String(drafts)} />
        <StatCard
          label="Pipeline (recent)"
          value={fmtCAD(pipeline)}
          className="col-span-2 lg:col-span-2"
        />
        <StatCard label="Phone" value={business.phone} small />
      </section>

      <section>
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-brand-gray mb-3">
          Tools
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tools.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group relative overflow-hidden rounded-2xl border border-brand-border bg-gradient-to-br from-brand-panel to-brand-charcoal p-5 hover:border-brand-gold/50 transition-all"
              >
                <div className="absolute inset-0 bg-brand-gold/0 group-hover:bg-brand-gold/5 transition-colors" />
                <Icon className="w-6 h-6 text-brand-gold mb-3" />
                <h3 className="text-base font-medium text-white">{item.label}</h3>
                <p className="text-xs text-brand-gray mt-1 leading-relaxed">{item.description}</p>
                <ArrowRight className="w-4 h-4 text-brand-gold mt-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            );
          })}
        </div>
      </section>

      {recentQuotes.length > 0 ? (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] font-mono uppercase tracking-widest text-brand-gray">
              Recent quotes
            </h2>
            <Link
              href="/admin/quotes"
              className="text-[10px] font-mono uppercase tracking-widest text-brand-gold hover:underline"
            >
              View all
            </Link>
          </div>
          <ul className="rounded-2xl border border-brand-border divide-y divide-brand-border overflow-hidden">
            {recentQuotes.map((q) => (
              <li
                key={q.id}
                className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-brand-charcoal/60 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-mono text-brand-gold">{q.id}</span>
                  <p className="text-sm text-white truncate">{q.customer.name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm text-white font-mono hidden sm:inline">
                    {fmtCAD(q.totals.grandTotalCAD)}
                  </span>
                  <Link
                    href={`/admin/quotes?edit=${encodeURIComponent(q.id)}`}
                    className="text-[9px] font-mono uppercase tracking-wider text-brand-gray hover:text-brand-gold px-2 py-1 border border-brand-border rounded"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/admin/quotes/${q.id}?download=1`}
                    className="text-[9px] font-mono uppercase tracking-wider text-brand-gold px-2 py-1 border border-brand-gold/40 rounded"
                  >
                    PDF
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  small,
  className = "",
}: {
  label: string;
  value: string;
  small?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-brand-border bg-brand-panel/80 px-4 py-3.5 ${className}`}
    >
      <p className="text-[10px] font-mono uppercase tracking-widest text-brand-gray">{label}</p>
      <p
        className={`mt-1 text-white font-medium ${small ? "text-sm" : "text-lg sm:text-xl"} truncate`}
      >
        {value}
      </p>
    </div>
  );
}
