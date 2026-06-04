/**
 * Server-only Supabase client (service role).
 * Never import this from client components.
 */

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

/** Server URL + service role (not the NEXT_PUBLIC publishable/anon key). */
export function getSupabaseServerConfig(): {
  url: string | undefined;
  serviceRoleKey: string | undefined;
} {
  return {
    url: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function isSupabaseConfigured(): boolean {
  const { url, serviceRoleKey } = getSupabaseServerConfig();
  return !!(url && serviceRoleKey);
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
