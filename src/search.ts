import type { PremiumSearchResult } from "./types.js";
import { config } from "./config.js";

type SearchSource = PremiumSearchResult["sources"][number];

type TavilyResponse = {
  answer?: string;
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
  }>;
};

type ExaResponse = {
  results?: Array<{
    title?: string;
    url?: string;
    text?: string;
    highlights?: string[];
  }>;
};

type BraveResponse = {
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
    }>;
  };
};

export class SearchProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchProviderError";
  }
}

export async function buildPremiumSearchResult(
  query: string,
  ledgerEntry: PremiumSearchResult["ledgerEntry"]
): Promise<PremiumSearchResult> {
  if (config.searchProvider === "tavily") {
    return searchWithTavily(query, ledgerEntry);
  }

  if (config.searchProvider === "exa") {
    return searchWithExa(query, ledgerEntry);
  }

  if (config.searchProvider === "brave") {
    return searchWithBrave(query, ledgerEntry);
  }

  return buildMockSearchResult(query, ledgerEntry);
}

function buildMockSearchResult(
  query: string,
  ledgerEntry: PremiumSearchResult["ledgerEntry"]
): PremiumSearchResult {
  return {
    query,
    summary:
      `Premium research summary for "${query}". This mock result stands in for a paid search API response ` +
      "that an autonomous agent can unlock after satisfying a 402-style payment requirement.",
    provider: "mock",
    sources: [
      {
        title: "Mock premium market scan",
        url: "https://example.com/premium/market-scan",
        snippet: "A synthesized premium search result generated after the mock payment receipt was accepted."
      },
      {
        title: "Mock analyst note",
        url: "https://example.com/premium/analyst-note",
        snippet: "A second paid source showing how multiple search results could be bundled behind one payment."
      }
    ],
    paid: true,
    ledgerEntry
  };
}

async function searchWithTavily(
  query: string,
  ledgerEntry: PremiumSearchResult["ledgerEntry"]
): Promise<PremiumSearchResult> {
  if (!config.tavilyApiKey) {
    throw new SearchProviderError("SEARCH_PROVIDER=tavily requires TAVILY_API_KEY");
  }

  const response = await fetchJson<TavilyResponse>("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.tavilyApiKey}`
    },
    body: JSON.stringify({
      query,
      search_depth: "advanced",
      max_results: config.searchResultLimit,
      include_answer: true
    })
  });

  const sources = (response.results ?? [])
    .map((result): SearchSource | undefined => {
      if (!result.url) {
        return undefined;
      }

      return {
        title: result.title ?? result.url,
        url: result.url,
        snippet: result.content ?? ""
      };
    })
    .filter((source): source is SearchSource => Boolean(source));

  return {
    query,
    summary: response.answer ?? summarizeFromSources(query, sources),
    provider: "tavily",
    sources,
    paid: true,
    ledgerEntry
  };
}

async function searchWithExa(
  query: string,
  ledgerEntry: PremiumSearchResult["ledgerEntry"]
): Promise<PremiumSearchResult> {
  if (!config.exaApiKey) {
    throw new SearchProviderError("SEARCH_PROVIDER=exa requires EXA_API_KEY");
  }

  const response = await fetchJson<ExaResponse>("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.exaApiKey
    },
    body: JSON.stringify({
      query,
      numResults: config.searchResultLimit,
      contents: {
        text: true,
        highlights: true
      }
    })
  });

  const sources = (response.results ?? [])
    .map((result): SearchSource | undefined => {
      if (!result.url) {
        return undefined;
      }

      return {
        title: result.title ?? result.url,
        url: result.url,
        snippet: result.highlights?.[0] ?? result.text ?? ""
      };
    })
    .filter((source): source is SearchSource => Boolean(source));

  return {
    query,
    summary: summarizeFromSources(query, sources),
    provider: "exa",
    sources,
    paid: true,
    ledgerEntry
  };
}

async function searchWithBrave(
  query: string,
  ledgerEntry: PremiumSearchResult["ledgerEntry"]
): Promise<PremiumSearchResult> {
  if (!config.braveApiKey) {
    throw new SearchProviderError("SEARCH_PROVIDER=brave requires BRAVE_API_KEY");
  }

  const params = new URLSearchParams({
    q: query,
    count: String(config.searchResultLimit)
  });
  const response = await fetchJson<BraveResponse>(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: {
      accept: "application/json",
      "x-subscription-token": config.braveApiKey
    }
  });

  const sources = (response.web?.results ?? [])
    .map((result): SearchSource | undefined => {
      if (!result.url) {
        return undefined;
      }

      return {
        title: result.title ?? result.url,
        url: result.url,
        snippet: result.description ?? ""
      };
    })
    .filter((source): source is SearchSource => Boolean(source));

  return {
    query,
    summary: summarizeFromSources(query, sources),
    provider: "brave",
    sources,
    paid: true,
    ledgerEntry
  };
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new SearchProviderError(`Search provider returned HTTP ${response.status}: ${await response.text()}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function summarizeFromSources(query: string, sources: SearchSource[]): string {
  if (sources.length === 0) {
    return `No search results were returned for "${query}". The mock payment succeeded, but the configured search provider had no matching sources.`;
  }

  const sourceTitles = sources
    .slice(0, 3)
    .map((source) => source.title)
    .join("; ");

  return `Premium search for "${query}" returned ${sources.length} source(s). Top sources: ${sourceTitles}.`;
}
