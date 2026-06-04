/**
 * Server-only Supabase client (secret / service_role key).
 * Never import this from client components.
 */

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

function pickSecretKey(): string | undefined {
  const direct =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim();
  if (direct) return direct;

  const raw = process.env.SUPABASE_SECRET_KEYS?.trim();
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed.default?.trim() || Object.values(parsed)[0]?.trim();
  } catch {
    return undefined;
  }
}

/** Server URL + elevated key (NOT the publishable sb_publishable_ key). */
export function getSupabaseServerConfig(): {
  url: string | undefined;
  serviceRoleKey: string | undefined;
} {
  return {
    url: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: pickSecretKey(),
  };
}

export function getSupabaseConfigStatus(): {
  ok: boolean;
  missing: string[];
  isVercel: boolean;
} {
  const { url, serviceRoleKey } = getSupabaseServerConfig();
  const missing: string[] = [];
  if (!url) missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) {
    missing.push("SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY");
  }
  return {
    ok: missing.length === 0,
    missing,
    isVercel: !!process.env.VERCEL,
  };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfigStatus().ok;
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const { url, serviceRoleKey } = getSupabaseServerConfig();
  if (!url || !serviceRoleKey) {
    cached = null;
    return null;
  }

  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
