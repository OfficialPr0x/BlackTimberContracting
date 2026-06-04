import type { Metadata } from "next";
import BookkeeperWorkspace from "@/components/admin/bookkeeper/BookkeeperWorkspace";

export const metadata: Metadata = {
  title: "AI Bookkeeper · Black Timber Admin",
  robots: { index: false, follow: false },
};

export default function AdminBookkeeperPage() {
  return <BookkeeperWorkspace />;
}
