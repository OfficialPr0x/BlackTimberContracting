"use client";

/**
 * Admin dashboard chrome — mobile bottom nav + desktop sidebar.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { LogOut } from "lucide-react";
import { ADMIN_NAV, isAdminNavActive } from "@/lib/admin/nav";
import { logoutAction } from "@/app/admin/actions";

const LOGO = "/black-timber-logo.png";

interface AdminShellProps {
  children: React.ReactNode;
  /** Optional banner (storage warnings, etc.) */
  banner?: React.ReactNode;
}

export default function AdminShell({ children, banner }: AdminShellProps) {
  const pathname = usePathname() ?? "/admin";
  const isBookkeeper = pathname.startsWith("/admin/bookkeeper");

  return (
    <div className="min-h-[100dvh] bg-brand-black text-foreground flex flex-col lg:flex-row print:min-h-0">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 print:hidden lg:shrink-0 lg:flex-col border-r border-brand-border bg-brand-charcoal/80">
        <div className="p-5 border-b border-brand-border">
          <Link href="/admin" className="flex items-center gap-3 group">
            <Image src={LOGO} alt="" width={40} height={40} className="rounded-lg" />
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-brand-gold">
                Black Timber
              </p>
              <p className="text-xs text-brand-gray group-hover:text-white transition-colors">
                Admin
              </p>
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {ADMIN_NAV.map((item) => {
            const active = isAdminNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                  active
                    ? "bg-brand-gold/15 text-brand-gold border border-brand-gold/30"
                    : "text-brand-gray hover:text-white hover:bg-brand-panel border border-transparent"
                }`}
              >
                <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="block text-[10px] text-brand-gray/90 mt-0.5 leading-snug">
                    {item.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-brand-border">
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-brand-border text-[10px] font-mono uppercase tracking-widest text-brand-gray hover:text-brand-gold hover:border-brand-gold/40 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-40 border-b border-brand-border bg-brand-charcoal/90 backdrop-blur-md">
          <div className="flex items-center justify-between px-4 py-3 gap-3">
            <Link href="/admin" className="flex items-center gap-2 min-w-0">
              <Image src={LOGO} alt="" width={32} height={32} className="rounded-md shrink-0" />
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-brand-gold truncate">
                Black Timber Admin
              </span>
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="p-2 text-brand-gray hover:text-brand-gold"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        </header>

        {banner ? <div className="px-4 pt-4 lg:px-8 lg:pt-6 max-w-6xl mx-auto w-full">{banner}</div> : null}

        <main
          className={
            isBookkeeper
              ? "flex-1 flex flex-col min-h-0 overflow-hidden pb-20 lg:pb-4 px-0 py-0 lg:px-0 lg:py-0 w-full max-w-none"
              : "flex-1 overflow-y-auto pb-24 lg:pb-8 px-4 py-5 lg:px-8 lg:py-8 max-w-6xl mx-auto w-full"
          }
        >
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-brand-border bg-brand-charcoal/95 backdrop-blur-md safe-area-pb"
          aria-label="Admin navigation"
        >
          <ul className="grid grid-cols-6 gap-0">
            {ADMIN_NAV.map((item) => {
              const active = isAdminNavActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex flex-col items-center justify-center py-2.5 px-1 gap-0.5 transition-colors ${
                      active ? "text-brand-gold" : "text-brand-gray"
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${active ? "drop-shadow-[0_0_8px_rgba(197,168,128,0.5)]" : ""}`} />
                    <span className="text-[9px] font-mono uppercase tracking-wider">
                      {item.shortLabel}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
