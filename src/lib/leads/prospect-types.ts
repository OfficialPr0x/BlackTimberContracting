/** Shared types for admin Leads UI (no server-only). */

export interface ProspectLeadRow {
  id: string;
  searchRunId: string | null;
  companyName: string;
  website: string | null;
  location: string | null;
  prospectType: string;
  fitScore: number;
  fitReason: string;
  collaborationAngle: string;
  suggestedContact: string | null;
  sourceUrl: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
