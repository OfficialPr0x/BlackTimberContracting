import "server-only";

const SERP_BASE = "https://serpapi.com/search.json";

/** Env names checked in order (first non-empty wins). */
const KEY_ENV_NAMES = ["SERPAPI_API_KEY", "SERPAPI_API", "SERPAPI_KEY"] as const;

export interface SerpOrganicResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export interface SerpApiConfigStatus {
  configured: boolean;
  /** Which env var supplied the key (for debugging — never exposes the value). */
  envVar: (typeof KEY_ENV_NAMES)[number] | null;
}

function isPlaceholder(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.includes("xxxx") || lower === "your_key" || lower === "changeme";
}

/** Resolve SerpAPI key from env (supports SERPAPI_API_KEY, SERPAPI_API, SERPAPI_KEY). */
export function pickSerpApiKey(): string | undefined {
  for (const name of KEY_ENV_NAMES) {
    const key = process.env[name]?.trim();
    if (key && !isPlaceholder(key)) return key;
  }
  return undefined;
}

export function getSerpApiConfigStatus(): SerpApiConfigStatus {
  for (const name of KEY_ENV_NAMES) {
    const key = process.env[name]?.trim();
    if (key && !isPlaceholder(key)) {
      return { configured: true, envVar: name };
    }
  }
  return { configured: false, envVar: null };
}

export function isSerpApiConfigured(): boolean {
  return getSerpApiConfigStatus().configured;
}

/**
 * Google search via SerpAPI — grounded local prospect discovery.
 * https://serpapi.com/google-search-api
 */
export async function serpGoogleSearch(
  query: string,
  opts?: { num?: number; location?: string }
): Promise<SerpOrganicResult[]> {
  const key = pickSerpApiKey();
  if (!key) return [];

  const defaultLocation =
    process.env.SERPAPI_LOCATION?.trim() ||
    "Cranbrook, British Columbia, Canada";

  const params = new URLSearchParams({
    engine: "google",
    q: query,
    api_key: key,
    num: String(opts?.num ?? 8),
    location: opts?.location ?? defaultLocation,
    gl: "ca",
    hl: "en",
  });

  const res = await fetch(`${SERP_BASE}?${params}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("[serpapi]", res.status, await res.text().catch(() => ""));
    return [];
  }

  const data = (await res.json()) as {
    organic_results?: Array<{
      title?: string;
      link?: string;
      snippet?: string;
      position?: number;
    }>;
    error?: string;
  };

  if (data.error) {
    console.error("[serpapi]", data.error);
    return [];
  }

  return (data.organic_results ?? [])
    .filter((r) => r.link && r.title)
    .map((r) => ({
      title: r.title!,
      link: r.link!,
      snippet: r.snippet ?? "",
      position: r.position ?? 0,
    }));
}

/** One lightweight search to confirm the key works (costs ~1 SerpAPI credit). */
export async function verifySerpApiConnection(): Promise<{
  ok: boolean;
  resultCount: number;
  error?: string;
}> {
  const key = pickSerpApiKey();
  if (!key) {
    return {
      ok: false,
      resultCount: 0,
      error: `Set ${KEY_ENV_NAMES.join(" or ")} in your environment.`,
    };
  }

  try {
    const results = await serpGoogleSearch("Black Timber Contracting Cranbrook", { num: 1 });
    if (results.length === 0) {
      return {
        ok: false,
        resultCount: 0,
        error: "SerpAPI returned no results — check your key and account credits at serpapi.com.",
      };
    }
    return { ok: true, resultCount: results.length };
  } catch (err) {
    return {
      ok: false,
      resultCount: 0,
      error: err instanceof Error ? err.message : "SerpAPI request failed",
    };
  }
}

export function formatSerpResultsForPrompt(
  query: string,
  results: SerpOrganicResult[]
): string {
  if (results.length === 0) return `Query "${query}": (no SerpAPI results)`;
  const lines = results.map(
    (r) => `- [${r.position}] ${r.title}\n  ${r.link}\n  ${r.snippet}`
  );
  return `### SerpAPI: ${query}\n${lines.join("\n")}`;
}
