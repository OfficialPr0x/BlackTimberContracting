/**
 * /admin — quote builder home page (server component).
 *
 * Re-verifies the session cryptographically (`getAdminSession`) BEFORE doing
 * anything else, per the Next.js 16 auth guide warning that proxy redirects
 * are optimistic-only and can be bypassed by direct route access.
 *
 * Loads the recent quotes server-side so the client component starts with a
 * useful list without an extra round-trip on first paint.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAdminSession } from "@/lib/admin/session";
import { listQuotes } from "@/lib/admin/quotes";
import { logoutAction } from "./actions";
import QuoteBuilder from "./quote-builder";

export const metadata: Metadata = {
  title: "Admin · Black Timber Quote Builder",
  robots: { index: false, follow: false },
};

// Quotes file is read on every request — no static caching.
export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?from=/admin");

  // Show the 25 most recent — enough to find a recent quote, small enough
  // to render fast even after years of use.
  const recentQuotes = await listQuotes(25);

  return (
    <main className="min-h-screen bg-brand-black text-foreground">
      <header className="border-b border-brand-border bg-brand-charcoal/60 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-mono text-[10px] uppercase tracking-[0.4em] text-brand-gold">
              Black Timber · Quote Builder
            </h1>
            <p className="text-[11px] text-brand-gray mt-0.5">
              Internal · Fernie HH PRO grounded · CAD
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-brand-gray hover:text-brand-gold border border-brand-border rounded-md transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 py-8">
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
    </main>
  );
}
