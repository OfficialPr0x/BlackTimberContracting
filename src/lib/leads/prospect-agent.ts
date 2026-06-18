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

/** Max SerpAPI queries per search (each costs ~1 credit). */
const SERP_QUERY_COUNT = 3;

function buildSerpQueries(focus: string, region: string): string[] {
  const base = [
    `general contractor ${region}`,
    `home builder developer ${region}`,
    `design build construction ${region}`,
  ];
  const focusWords = focus
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .slice(0, 3);
  if (focusWords.length) {
    base.push(`${focusWords.join(" ")} ${region}`);
  }
  return [...new Set(base)].slice(0, SERP_QUERY_COUNT);
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
  const serpOn = isSerpApiConfigured();

  const [portfolioBrief, serpBlocks] = await Promise.all([
    // On cold cache, cap vision wait so we stay under Vercel's ~60s function limit.
    getPortfolioBrief({ maxWaitMs: 18_000 }),
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
    serpOn
      ? "SerpAPI Google results above are your primary web grounding. Synthesize from those; only infer websites you can justify from snippets or known BC directories."
      : "Use live web search (model-native) to verify companies, find websites, and fill gaps.",
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

  // When SerpAPI grounds the search, use fast Gemini Flash synthesis (no slow Sonar web crawl).
  // Without SerpAPI, Perplexity Sonar provides native web search.
  const extraBody: Record<string, unknown> | undefined =
    !serpOn && process.env.OPENROUTER_PROSPECT_WEB_TOOL === "true"
      ? {
          tools: [
            {
              type: "openrouter:web_search",
              max_results: 6,
              search_prompt: "BC Kootenay construction companies:",
            },
          ],
        }
      : undefined;

  const output = await chatJSON({
    task: serpOn ? "parse" : "prospect",
    schema: ProspectSearchOutput,
    schemaName: "ProspectSearchOutput",
    messages,
    temperature: 0.35,
    jsonObject: true,
    timeoutMs: serpOn ? 32_000 : 42_000,
    maxModels: 2,
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
    webSearchEnabled: !serpOn,
    portfolioBriefUsed: true,
  };
}

async function runSerpBlock(focus: string, region: string) {
  if (!isSerpApiConfigured()) {
    return {
      enabled: false,
      queries: [] as string[],
      text: "(SerpAPI not configured — set SERPAPI_API_KEY or SERPAPI_API in Vercel for Google SERP grounding.)",
    };
  }

  const queries = buildSerpQueries(focus, region);

  // Parallel fetches — sequential was adding 10–15s and causing 504 timeouts.
  const blocks = await Promise.all(
    queries.map(async (q) => {
      const results = await serpGoogleSearch(q, { num: 5 });
      return formatSerpResultsForPrompt(q, results);
    })
  );

  return {
    enabled: true,
    queries,
    text: blocks.join("\n\n"),
  };
}
