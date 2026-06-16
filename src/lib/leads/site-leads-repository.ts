import "server-only";

import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import type { LeadInput } from "@/lib/openrouter/schemas";
import type { SiteLeadRow, SiteLeadStatus } from "@/lib/leads/site-leads-types";

export type { SiteLeadRow, SiteLeadStatus } from "@/lib/leads/site-leads-types";

export async function insertSiteLead(
  lead: LeadInput,
  delivery: { file: boolean; email: boolean; slack: boolean; errors: string[] },
  extras?: { status?: SiteLeadStatus; tags?: string[] }
): Promise<string | null> {
  const sb = getSupabaseAdmin();
  if (!sb || !isSupabaseConfigured()) return null;

  const tags = extras?.tags ?? tagsFromPayload(lead);
  const status = extras?.status ?? statusFromPayload(lead);

  const { data, error } = await sb.rpc("insert_lead", {
    p_source: lead.source,
    p_name: lead.contact.name,
    p_email: lead.contact.email,
    p_phone: lead.contact.phone ?? null,
    p_address: lead.contact.address ?? null,
    p_payload: {
      ...lead.payload,
      tags,
      crmStatus: status,
    },
    p_delivered_file: delivery.file,
    p_delivered_email: delivery.email,
    p_delivered_slack: delivery.slack,
    p_delivery_errors: delivery.errors,
  });

  if (error) {
    console.error("[insert_lead]", error.message);
    return null;
  }

  const leadId = data as string;
  if (status !== "new" || tags.length > 0) {
    const { error: updErr } = await sb.rpc("update_site_lead", {
      p_id: leadId,
      p_status: status,
      p_tags: tags,
      p_notes: null,
    });
    if (updErr) {
      console.warn("[update_site_lead]", updErr.message, "— run supabase/site-leads-crm.sql");
    }
  }

  return leadId;
}

interface ListLeadsFilter {
  source?: string;
  excludeSource?: string;
}

async function queryLeads(limit: number, filter?: ListLeadsFilter): Promise<SiteLeadRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb || !isSupabaseConfigured()) return [];

  let q = sb
    .from("leads")
    .select(
      "id, source, name, email, phone, address, payload, status, tags, notes, delivered_file, delivered_email, delivered_slack, delivery_errors, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filter?.source) q = q.eq("source", filter.source);
  if (filter?.excludeSource) q = q.neq("source", filter.excludeSource);

  const { data, error } = await q;

  if (error) {
    console.error("[list leads]", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    source: r.source as string,
    name: r.name as string,
    email: r.email as string,
    phone: (r.phone as string) ?? null,
    address: (r.address as string) ?? null,
    payload: (r.payload as Record<string, unknown>) ?? {},
    status: (r.status as SiteLeadStatus) ?? "new",
    tags: (r.tags as string[]) ?? [],
    notes: (r.notes as string) ?? null,
    deliveredFile: !!r.delivered_file,
    deliveredEmail: !!r.delivered_email,
    deliveredSlack: !!r.delivered_slack,
    deliveryErrors: (r.delivery_errors as string[]) ?? [],
    createdAt: r.created_at as string,
  }));
}

/** Quote wizard estimates, bookings, property intel — not exit-intent popup signups. */
export async function listSiteLeads(limit = 100): Promise<SiteLeadRow[]> {
  return queryLeads(limit, { excludeSource: "exit_intent" });
}

/** Before-you-leave deck guide popup email captures. */
export async function listPopupSubs(limit = 150): Promise<SiteLeadRow[]> {
  return queryLeads(limit, { source: "exit_intent" });
}

export async function deleteSiteLeads(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const sb = getSupabaseAdmin();
  if (!sb || !isSupabaseConfigured()) return 0;

  const { error } = await sb.from("leads").delete().in("id", ids);
  if (error) {
    console.error("[delete leads]", error.message);
    return 0;
  }
  return ids.length;
}

export async function deleteSiteLead(id: string): Promise<boolean> {
  return (await deleteSiteLeads([id])) === 1;
}

export async function updateSiteLead(
  id: string,
  patch: { status?: SiteLeadStatus; tags?: string[]; notes?: string | null }
): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb || !isSupabaseConfigured()) return false;

  const { error } = await sb.rpc("update_site_lead", {
    p_id: id,
    p_status: patch.status ?? null,
    p_tags: patch.tags ?? null,
    p_notes: patch.notes ?? null,
  });

  if (error) {
    console.error("[update_site_lead]", error.message);
    return false;
  }
  return true;
}

function tagsFromPayload(lead: LeadInput): string[] {
  const p = lead.payload as { tags?: string[] } | undefined;
  if (Array.isArray(p?.tags)) return p.tags;
  return [lead.source.replace(/_/g, "-")];
}

function statusFromPayload(lead: LeadInput): SiteLeadStatus {
  const p = lead.payload as { stage?: string; preferredDate?: string } | undefined;
  if (p?.preferredDate) return "booked";
  if (p?.stage === "estimate_generated") return "estimate";
  return "new";
}
