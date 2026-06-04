import "server-only";

import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ProspectSearchOutput } from "./prospect-schemas";
import type { ProspectLeadRow } from "./prospect-types";

export type { ProspectLeadRow };

export async function saveProspectSearchRun(params: {
  focus: string;
  region: string;
  summary: string;
  queriesUsed: string[];
  output: ProspectSearchOutput;
}): Promise<string | null> {
  const sb = getSupabaseAdmin();
  if (!sb || !isSupabaseConfigured()) return null;

  const { data: run, error: runErr } = await sb
    .from("prospect_search_runs")
    .insert({
      focus: params.focus,
      region: params.region,
      summary: params.summary,
      queries_used: params.queriesUsed,
      raw_payload: params.output,
    })
    .select("id")
    .single();

  if (runErr || !run) {
    console.error("[prospect_search_runs]", runErr?.message);
    return null;
  }

  const runId = run.id as string;

  if (params.output.prospects.length > 0) {
    const rows = params.output.prospects.map((p) => ({
      search_run_id: runId,
      company_name: p.companyName,
      website: p.website ?? null,
      location: p.location ?? null,
      prospect_type: p.prospectType,
      fit_score: p.fitScore,
      fit_reason: p.fitReason,
      collaboration_angle: p.collaborationAngle,
      suggested_contact: p.suggestedContact ?? null,
      source_url: p.sourceUrl ?? null,
      payload: { portfolioMatchNotes: p.portfolioMatchNotes ?? null },
    }));

    const { error: insErr } = await sb.from("prospect_leads").insert(rows);
    if (insErr) console.error("[prospect_leads insert]", insErr.message);
  }

  return runId;
}

export async function listProspectLeads(limit = 80): Promise<ProspectLeadRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb || !isSupabaseConfigured()) return [];

  const { data, error } = await sb
    .from("prospect_leads")
    .select(
      "id, search_run_id, company_name, website, location, prospect_type, fit_score, fit_reason, collaboration_angle, suggested_contact, source_url, status, notes, created_at, updated_at"
    )
    .order("fit_score", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[list prospect_leads]", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    searchRunId: (r.search_run_id as string) ?? null,
    companyName: r.company_name as string,
    website: (r.website as string) ?? null,
    location: (r.location as string) ?? null,
    prospectType: r.prospect_type as string,
    fitScore: Number(r.fit_score),
    fitReason: r.fit_reason as string,
    collaborationAngle: r.collaboration_angle as string,
    suggestedContact: (r.suggested_contact as string) ?? null,
    sourceUrl: (r.source_url as string) ?? null,
    status: r.status as string,
    notes: (r.notes as string) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }));
}

export async function updateProspectLead(
  id: string,
  patch: { status?: string; notes?: string }
): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;

  const { error } = await sb
    .from("prospect_leads")
    .update({
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    })
    .eq("id", id);

  return !error;
}
