import { z } from "zod";

export const ProspectSearchInput = z.object({
  focus: z.string().min(4).max(1200).default(
    "General contractors, design-build firms, and residential developers in the East Kootenay for subcontracting (decks, exterior, finishing) or collaboration."
  ),
  region: z.string().max(200).default("East Kootenay, BC"),
  saveResults: z.boolean().default(true),
});

export type ProspectSearchInput = z.infer<typeof ProspectSearchInput>;

export const ProspectRecord = z.object({
  companyName: z.string().min(1).max(200),
  website: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
  prospectType: z.enum([
    "developer",
    "general_contractor",
    "builder",
    "design_build",
    "property_manager",
    "other",
  ]),
  fitScore: z.number().int().min(0).max(100),
  fitReason: z.string().min(1).max(2000),
  collaborationAngle: z.string().min(1).max(2000),
  suggestedContact: z.string().max(500).optional(),
  sourceUrl: z.string().max(500).optional(),
  portfolioMatchNotes: z.string().max(1500).optional(),
});

export const ProspectSearchOutput = z.object({
  summary: z.string().min(1).max(4000),
  prospects: z.array(ProspectRecord).min(0).max(25),
  searchQueriesUsed: z.array(z.string()).max(12),
  nextSteps: z.array(z.string()).max(10),
});

export type ProspectSearchOutput = z.infer<typeof ProspectSearchOutput>;
