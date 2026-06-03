/**
 * Server actions for /admin auth.
 *
 * Lives in its own file (rather than inline in the login page) so other
 * pages — like the admin home, which needs a Logout button — can import the
 * `logoutAction` without dragging in the login page module.
 *
 * `"use server"` directive at the top: every export from this file is a
 * Server Action. They run on the server, accept FormData, and return only
 * what's safe to render in the browser.
 */

"use server";

import { redirect } from "next/navigation";
import {
  createAdminSession,
  destroyAdminSession,
  getAdminConfigStatus,
  verifyAdminPassword,
} from "@/lib/admin/session";

/**
 * Login form action. Verifies the password and, on success, mints a session
 * cookie and redirects to /admin (or `from` if it was passed through the
 * query string and looks safe).
 *
 * On failure the action redirects back to the login page with an `?error=`
 * marker. We deliberately don't return field errors via useActionState here;
 * a single password field doesn't need richer state than that, and a plain
 * `<form action={...}>` works without JS.
 */
export async function loginAction(formData: FormData): Promise<void> {
  const status = getAdminConfigStatus();
  if (!status.configured) {
    redirect("/admin/login?error=not_configured");
  }

  const password = String(formData.get("password") ?? "");
  const fromRaw = String(formData.get("from") ?? "");

  if (!verifyAdminPassword(password)) {
    redirect("/admin/login?error=invalid");
  }

  await createAdminSession();

  // Open-redirect guard: only follow `from` if it's a relative /admin path.
  const safeFrom =
    fromRaw.startsWith("/admin") && !fromRaw.startsWith("//") ? fromRaw : "/admin";
  redirect(safeFrom);
}

/** Clear the cookie and bounce back to the login page. */
export async function logoutAction(): Promise<void> {
  await destroyAdminSession();
  redirect("/admin/login");
}
