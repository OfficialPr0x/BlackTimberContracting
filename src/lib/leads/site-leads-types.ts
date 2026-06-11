export type SiteLeadStatus = "new" | "estimate" | "booked" | "contacted" | "won" | "lost";

export interface SiteLeadRow {
  id: string;
  source: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  payload: Record<string, unknown>;
  status: SiteLeadStatus;
  tags: string[];
  notes: string | null;
  deliveredFile: boolean;
  deliveredEmail: boolean;
  deliveredSlack: boolean;
  deliveryErrors: string[];
  createdAt: string;
}
