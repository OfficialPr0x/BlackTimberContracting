"use client";

/**
 * Admin route error boundary — avoids a blank Vercel "server error" page.
 */

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] route error", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-brand-black text-foreground flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-lg font-mono uppercase tracking-widest text-brand-gold">
          Admin could not load
        </h1>
        <p className="text-sm text-brand-gray">
          This is usually a missing Supabase secret key or schema. Check Vercel environment
          variables and run <span className="font-mono text-white">supabase/schema.sql</span>.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 rounded-lg bg-brand-gold text-brand-black text-xs font-mono uppercase tracking-widest font-bold"
          >
            Try again
          </button>
          <a
            href="/admin/login"
            className="px-4 py-2 rounded-lg border border-brand-border text-xs font-mono uppercase tracking-widest text-brand-gray hover:text-brand-gold"
          >
            Back to login
          </a>
        </div>
      </div>
    </main>
  );
}
