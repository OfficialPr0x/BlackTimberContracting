import AdminShell from "@/components/admin/AdminShell";
import AdminStorageBanner from "@/components/admin/AdminStorageBanner";
import { requireAdminPage } from "@/lib/admin/page-auth";

export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage("/admin");

  return (
    <AdminShell banner={<AdminStorageBanner />}>{children}</AdminShell>
  );
}
