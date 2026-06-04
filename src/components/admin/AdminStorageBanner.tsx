import { getSupabaseConfigStatus } from "@/lib/supabase/server";

export default function AdminStorageBanner() {
  const storage = getSupabaseConfigStatus();
  if (storage.ok) return null;

  return (
    <div
      className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
      role="alert"
    >
      <p className="font-medium text-amber-200">Saves need Supabase secret key</p>
      <p className="mt-1 text-xs text-amber-100/90 leading-relaxed">
        Add <span className="font-mono text-amber-300">SUPABASE_SECRET_KEY</span> (
        <span className="font-mono">sb_secret_…</span>) in{" "}
        {storage.isVercel ? "Vercel" : ".env.local"}. Run{" "}
        <span className="font-mono">supabase/schema.sql</span>, then redeploy.
        {storage.missing.length > 0 ? <> Missing: {storage.missing.join(", ")}.</> : null}
      </p>
    </div>
  );
}
