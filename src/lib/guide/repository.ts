import "server-only";

import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import { GUIDE_SLUG } from "./constants";
import { generateGuidePassword, hashGuidePassword, verifyGuidePassword } from "./password";
import {
  fileListGuideSubscribers,
  fileMarkWelcomeEmailSent,
  fileUpsertGuideSubscriber,
  fileVerifyGuideSubscriber,
} from "./file-store";
import type { CreateGuideSubscriberResult, GuideSubscriberRow } from "./types";

export type { CreateGuideSubscriberResult, GuideSubscriberRow } from "./types";

export async function createOrRefreshGuideSubscriber(input: {
  name: string;
  email: string;
  leadId?: string | null;
  password?: string;
  passwordHash?: string;
}): Promise<CreateGuideSubscriberResult | null> {
  const email = input.email.trim().toLowerCase();
  const password = input.password ?? generateGuidePassword();
  const passwordHash = input.passwordHash ?? hashGuidePassword(password);

  const sb = getSupabaseAdmin();
  if (!sb || !isSupabaseConfigured()) {
    return fileUpsertGuideSubscriber({
      name: input.name,
      email,
      leadId: input.leadId,
      password,
      passwordHash,
    });
  }

  const { data: existing } = await sb
    .from("guide_subscribers")
    .select("id")
    .eq("email", email)
    .eq("guide_slug", GUIDE_SLUG)
    .maybeSingle();

  const row = {
    name: input.name.trim(),
    email,
    password_hash: passwordHash,
    guide_slug: GUIDE_SLUG,
    lead_id: input.leadId ?? null,
    welcome_email_sent: false,
    welcome_email_error: null,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { data, error } = await sb
      .from("guide_subscribers")
      .update(row)
      .eq("id", existing.id as string)
      .select("id")
      .single();
    if (error) {
      console.error("[guide_subscribers update]", error.message);
      return fileUpsertGuideSubscriber({
        name: input.name,
        email,
        leadId: input.leadId,
        password,
        passwordHash,
      });
    }
    return {
      subscriberId: data.id as string,
      password,
      email,
      name: row.name,
      isNew: false,
    };
  }

  const { data, error } = await sb
    .from("guide_subscribers")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    console.error("[guide_subscribers insert]", error.message);
    return fileUpsertGuideSubscriber({
      name: input.name,
      email,
      leadId: input.leadId,
      password,
      passwordHash,
    });
  }

  return {
    subscriberId: data.id as string,
    password,
    email,
    name: row.name,
    isNew: true,
  };
}

export async function verifyGuideSubscriber(
  email: string,
  password: string
): Promise<GuideSubscriberRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb || !isSupabaseConfigured()) {
    return fileVerifyGuideSubscriber(email, password);
  }

  const { data, error } = await sb
    .from("guide_subscribers")
    .select(
      "id, name, email, password_hash, guide_slug, lead_id, welcome_email_sent, welcome_email_error, created_at"
    )
    .eq("email", email.trim().toLowerCase())
    .eq("guide_slug", GUIDE_SLUG)
    .maybeSingle();

  if (error || !data) return null;
  if (!verifyGuidePassword(password, data.password_hash as string)) return null;

  return {
    id: data.id as string,
    name: data.name as string,
    email: data.email as string,
    passwordHash: data.password_hash as string,
    guideSlug: data.guide_slug as string,
    leadId: (data.lead_id as string) ?? null,
    welcomeEmailSent: !!data.welcome_email_sent,
    welcomeEmailError: (data.welcome_email_error as string) ?? null,
    createdAt: data.created_at as string,
  };
}

export async function markWelcomeEmailSent(
  subscriberId: string,
  ok: boolean,
  errMsg?: string
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb || !isSupabaseConfigured()) {
    await fileMarkWelcomeEmailSent(subscriberId, ok, errMsg);
    return;
  }
  await sb
    .from("guide_subscribers")
    .update({
      welcome_email_sent: ok,
      welcome_email_error: ok ? null : (errMsg ?? "send failed"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriberId);
}

export async function listGuideSubscribers(limit = 200): Promise<GuideSubscriberRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb || !isSupabaseConfigured()) {
    return fileListGuideSubscribers(limit);
  }

  const { data, error } = await sb
    .from("guide_subscribers")
    .select(
      "id, name, email, password_hash, guide_slug, lead_id, welcome_email_sent, welcome_email_error, created_at"
    )
    .eq("guide_slug", GUIDE_SLUG)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[list guide_subscribers]", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    email: r.email as string,
    passwordHash: r.password_hash as string,
    guideSlug: r.guide_slug as string,
    leadId: (r.lead_id as string) ?? null,
    welcomeEmailSent: !!r.welcome_email_sent,
    welcomeEmailError: (r.welcome_email_error as string) ?? null,
    createdAt: r.created_at as string,
  }));
}
