import "server-only";

const SERP_BASE = "https://serpapi.com/search.json";

export interface SerpOrganicResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export function isSerpApiConfigured(): boolean {
  const key = process.env.SERPAPI_API_KEY?.trim();
  return !!key && !key.includes("xxxx");
}

/**
 * Google search via SerpAPI — grounded local prospect discovery.
 * https://serpapi.com/google-search-api
 */
export async function serpGoogleSearch(
  query: string,
  opts?: { num?: number; location?: string }
): Promise<SerpOrganicResult[]> {
  const key = process.env.SERPAPI_API_KEY?.trim();
  if (!key || key.includes("xxxx")) {
    return [];
  }

  const params = new URLSearchParams({
    engine: "google",
    q: query,
    api_key: key,
    num: String(opts?.num ?? 8),
    location: opts?.location ?? "Cranbrook, British Columbia, Canada",
    gl: "ca",
    hl: "en",
  });

  const res = await fetch(`${SERP_BASE}?${params}`, {
    next: { revalidate: 0 },
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
