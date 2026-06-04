import "server-only";

import { chatJSON, type ChatMessage } from "@/lib/openrouter/client";
import { PROSPECT_SEARCH_PROMPT } from "@/lib/openrouter/prompts";
import {
  formatSerpResultsForPrompt,
  isSerpApiConfigured,
  serpGoogleSearch,
} from "@/lib/serpapi/client";
import { getPortfolioBrief } from "./portfolio-brief";
import { ProspectSearchOutput, type ProspectSearchInput } from "./prospect-schemas";
import { saveProspectSearchRun } from "./prospects-repository";

function buildSerpQueries(focus: string, region: string): string[] {
  const base = [
    `general contractor ${region}`,
    `home builder developer ${region}`,
    `design build construction ${region}`,
    `custom home construction Cranbrook Fernie Kimberley`,
  ];
  const focusWords = focus
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .slice(0, 4);
  if (focusWords.length) {
    base.push(`${focusWords.join(" ")} ${region}`);
  }
  return [...new Set(base)].slice(0, 5);
}

export interface ProspectSearchResult {
  output: ProspectSearchOutput;
  searchRunId: string | null;
  serpEnabled: boolean;
  webSearchEnabled: boolean;
  portfolioBriefUsed: boolean;
}

export async function runProspectSearch(
  input: ProspectSearchInput
): Promise<ProspectSearchResult> {
  const [portfolioBrief, serpBlocks] = await Promise.all([
    getPortfolioBrief(),
    runSerpBlock(input.focus, input.region),
  ]);

  const system = [
    PROSPECT_SEARCH_PROMPT,
    "",
    "## Portfolio capabilities (vision-trained on real job photos)",
    portfolioBrief,
    "",
    serpBlocks.text,
    "",
    "Use live web search (model-native) to verify companies, find websites, and fill gaps SerpAPI missed.",
    "Prioritize East Kootenay / BC interior. Score fit 0-100 vs Black Timber's actual portfolio.",
  ].join("\n");

  const userMsg = [
    `Prospecting focus: ${input.focus}`,
    `Region: ${input.region}`,
    "",
    "Find high-value B2B prospects for subcontracting OR collaboration (not homeowner leads).",
    "Return strict JSON matching ProspectSearchOutput schema.",
  ].join("\n");

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: userMsg },
  ];

  // Primary model (Perplexity Sonar) has native web search — same pattern as site-intel.
  // Optional: OPENROUTER_PROSPECT_WEB_TOOL=true adds openrouter:web_search for Gemini fallbacks.
  const extraBody: Record<string, unknown> | undefined =
    process.env.OPENROUTER_PROSPECT_WEB_TOOL === "true"
      ? {
          tools: [
            {
              type: "openrouter:web_search",
              max_results: 8,
              search_prompt: "BC Kootenay construction companies:",
            },
          ],
        }
      : undefined;

  const output = await chatJSON({
    task: "prospect",
    schema: ProspectSearchOutput,
    schemaName: "ProspectSearchOutput",
    messages,
    temperature: 0.35,
    jsonObject: true,
    timeoutMs: 55_000,
    maxModels: 3,
    maxUsd: Number(process.env.AI_MAX_USD_PROSPECT ?? "0.85"),
    extraBody,
  });

  const queriesUsed = [
    ...serpBlocks.queries,
    ...(output.searchQueriesUsed ?? []),
  ];

  let searchRunId: string | null = null;
  if (input.saveResults) {
    searchRunId = await saveProspectSearchRun({
      focus: input.focus,
      region: input.region,
      summary: output.summary,
      queriesUsed,
      output,
    });
  }

  return {
    output: { ...output, searchQueriesUsed: queriesUsed },
    searchRunId,
    serpEnabled: serpBlocks.enabled,
    webSearchEnabled: true,
    portfolioBriefUsed: true,
  };
}

async function runSerpBlock(focus: string, region: string) {
  if (!isSerpApiConfigured()) {
    return {
      enabled: false,
      queries: [] as string[],
      text: "(SerpAPI not configured — set SERPAPI_API_KEY for local Google results.)",
    };
  }

  const queries = buildSerpQueries(focus, region);
  const blocks: string[] = [];

  for (const q of queries) {
    const results = await serpGoogleSearch(q, { num: 6 });
    blocks.push(formatSerpResultsForPrompt(q, results));
  }

  return {
    enabled: true,
    queries,
    text: blocks.join("\n\n"),
  };
}
