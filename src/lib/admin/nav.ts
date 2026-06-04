import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FileText,
  Calculator,
  MessageCircle,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
}

export const ADMIN_NAV: AdminNavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    shortLabel: "Home",
    description: "Overview, quick actions, recent work",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/quotes",
    label: "Quotes",
    shortLabel: "Quotes",
    description: "Build quotes, estimates & invoices",
    icon: FileText,
  },
  {
    href: "/admin/bookkeeper",
    label: "AI Bookkeeper",
    shortLabel: "Books",
    description: "GST, expenses, job costing — CAD",
    icon: Calculator,
  },
  {
    href: "/admin/concierge",
    label: "Concierge",
    shortLabel: "Chat",
    description: "Talk or voice — your ops assistant",
    icon: MessageCircle,
  },
];

export function isAdminNavActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
