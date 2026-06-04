import type { Metadata } from "next";
import LeadsWorkspace from "@/components/admin/leads/LeadsWorkspace";

export const metadata: Metadata = {
  title: "Leads · Black Timber Admin",
  robots: { index: false, follow: false },
};

export default function AdminLeadsPage() {
  return <LeadsWorkspace />;
}
