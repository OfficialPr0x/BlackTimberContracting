import { redirect } from "next/navigation";
import { getAdminSession } from "./session";

/** Redirect to login if no valid admin session. */
export async function requireAdminPage(fromPath: string): Promise<void> {
  const session = await getAdminSession();
  if (!session) {
    redirect(`/admin/login?from=${encodeURIComponent(fromPath)}`);
  }
}
