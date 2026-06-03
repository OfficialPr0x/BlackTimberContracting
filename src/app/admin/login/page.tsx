/**
 * /admin/login — single-password gate for the quote builder.
 *
 * Server component, plain HTML <form> posting to the loginAction Server
 * Action. Works without JS, no client component needed.
 *
 * Rendering rules:
 *   - If admin is not configured (missing ADMIN_PASSWORD or
 *     ADMIN_SESSION_SECRET), render a setup-required panel instead of the
 *     login form. This is friendlier than a generic 503 for self-hosters.
 *   - If `?error=invalid` is in the URL, show "Wrong password".
 *   - If `?error=not_configured` is in the URL (server action redirected
 *     here because the env was changed mid-request), show the setup panel
 *     too.
 *   - `?from=/admin/...` carries the originally-requested path so the
 *     server action can bounce them back after login.
 */

import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { getAdminConfigStatus, getAdminSession } from "@/lib/admin/session";
import { loginAction } from "../actions";

export const metadata: Metadata = {
  title: "Admin · Black Timber Contracting",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ error?: string; from?: string }>;
}

export default async function AdminLoginPage({ searchParams }: PageProps) {
  // If they're already signed in, jump straight to the builder.
  const session = await getAdminSession();
  if (session) redirect("/admin");

  const { error, from } = await searchParams;
  const config = getAdminConfigStatus();
  const showSetupPanel = !config.configured || error === "not_configured";

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-brand-black">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Image
            src="https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1779592928/ChatGPT_Image_May_23__2026__08_07_11_PM-removebg-preview_f81lz0.png"
            alt="Black Timber Contracting"
            width={64}
            height={64}
            className="mx-auto mb-4 opacity-90"
            priority
          />
          <h1 className="font-mono text-[10px] uppercase tracking-[0.4em] text-brand-gold">
            Black Timber · Quote Builder
          </h1>
          <p className="mt-3 text-sm text-brand-gray">
            Internal tool. Sign in to draft a quote.
          </p>
        </div>

        {showSetupPanel ? (
          <SetupRequiredPanel
            missingPassword={config.missingPassword}
            missingSecret={config.missingSecret}
          />
        ) : (
          <form
            action={loginAction}
            className="glass-panel-strong rounded-xl p-7 space-y-5"
          >
            {from ? <input type="hidden" name="from" value={from} /> : null}
            <label className="block">
              <span className="block text-[10px] uppercase tracking-widest text-brand-gray mb-2">
                Admin password
              </span>
              <input
                type="password"
                name="password"
                required
                autoFocus
                autoComplete="current-password"
                className="w-full rounded-lg bg-brand-charcoal border border-brand-border focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/40 outline-none px-4 py-3 text-base font-mono text-white"
              />
            </label>

            {error === "invalid" ? (
              <p className="text-xs text-red-400 font-mono">
                Wrong password. Try again or reset <code>ADMIN_PASSWORD</code>{" "}
                in <code>.env.local</code>.
              </p>
            ) : null}

            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-extrabold uppercase tracking-widest text-xs transition-colors"
            >
              Sign in
            </button>
            <p className="text-[10px] text-brand-gray font-mono leading-relaxed pt-2">
              Sessions expire after 12 hours. The cookie is HttpOnly and signed
              with HMAC-SHA256.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}

function SetupRequiredPanel({
  missingPassword,
  missingSecret,
}: {
  missingPassword: boolean;
  missingSecret: boolean;
}) {
  return (
    <div className="glass-panel-strong rounded-xl p-7 space-y-4 border border-brand-gold/30">
      <h2 className="text-base font-bold text-brand-gold">Setup required</h2>
      <p className="text-sm text-brand-gray">
        Admin is disabled until two environment variables are set in{" "}
        <code className="font-mono">.env.local</code>:
      </p>
      <ul className="space-y-2 text-xs font-mono">
        <li className={missingPassword ? "text-red-400" : "text-brand-gray"}>
          {missingPassword ? "✗" : "✓"} <code>ADMIN_PASSWORD</code>
          <span className="text-brand-gray">
            {" "}— the password you&apos;ll type at this screen
          </span>
        </li>
        <li className={missingSecret ? "text-red-400" : "text-brand-gray"}>
          {missingSecret ? "✗" : "✓"} <code>ADMIN_SESSION_SECRET</code>
          <span className="text-brand-gray">
            {" "}— at least 16 chars; rotate to log everyone out
          </span>
        </li>
      </ul>
      <pre className="text-[10px] font-mono bg-brand-charcoal border border-brand-border rounded-lg p-3 overflow-x-auto whitespace-pre">
        {`ADMIN_PASSWORD=choose-a-strong-one
ADMIN_SESSION_SECRET=$(openssl rand -hex 32)`}
      </pre>
      <p className="text-xs text-brand-gray">
        After editing <code>.env.local</code>, restart the dev server so Next
        re-reads the environment.
      </p>
    </div>
  );
}
