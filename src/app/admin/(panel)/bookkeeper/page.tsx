import type { Metadata } from "next";
import AdminChat from "@/components/admin/AdminChat";

export const metadata: Metadata = {
  title: "AI Bookkeeper · Black Timber Admin",
  robots: { index: false, follow: false },
};

export default function AdminBookkeeperPage() {
  return (
    <AdminChat
      apiPath="/api/admin/bookkeeper"
      title="AI Bookkeeper"
      subtitle="GST/PST, job costing, expenses, and margin checks — CAD, BC contractor context. Not tax advice; confirm with your accountant."
      openingLines={[
        "Paste bank lines, supplier receipts, or describe a job's costs.",
        'Example: "Deposited $4,200 from Smith — which quote does that hit? GST on the materials-only line?"',
        "I'll help you organize and flag what needs a receipt or split quote.",
      ]}
      placeholder="Describe a transaction, expense, or tax question…"
    />
  );
}
