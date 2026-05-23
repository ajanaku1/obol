/**
 * The x402 data market — the paid vendors Obol shops from.
 *
 * Each vendor is framed as the kind of metered service a research desk would
 * otherwise hold a subscription for: a market terminal, a filings desk, a
 * scholar index, an attention signal feed. Obol pays per call instead — a few
 * tenths of a cent — so it never carries a subscription it uses once.
 *
 * Upstreams are real public APIs; the demo runs with no API keys. What's
 * priced here is metered access and the agent's judgement in choosing it.
 */

/** A vendor in the market: a priced, callable data source. */
export interface Vendor {
  id: string;
  name: string;
  description: string;
  /** Price per call in USDC base units (6 decimals). 1000 = $0.001. */
  priceBaseUnits: number;
  /** A JSON-shape hint so the agent knows what to send. */
  inputSchema: Record<string, string>;
  fetch: (input: Record<string, unknown>) => Promise<unknown>;
}

const str = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required string field: "${key}"`);
  }
  return value.trim();
};

async function getJson(
  url: string,
  headers: Record<string, string> = {},
): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Obol/0.1 (x402 agent)", ...headers },
  });
  if (!res.ok) throw new Error(`Upstream responded ${res.status} ${res.statusText}`);
  return res.json();
}

/** SEC EDGAR requires a descriptive User-Agent on every request. */
const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT ?? "Obol research agent (https://github.com/obol)";

interface TickerRow {
  cik_str: number;
  ticker: string;
  title: string;
}

let tickerIndex: Map<string, TickerRow> | undefined;

async function resolveCik(ticker: string): Promise<TickerRow> {
  if (!tickerIndex) {
    const rows = (await getJson("https://www.sec.gov/files/company_tickers.json", {
      "User-Agent": SEC_USER_AGENT,
    })) as Record<string, TickerRow>;
    tickerIndex = new Map();
    for (const row of Object.values(rows)) {
      tickerIndex.set(row.ticker.toUpperCase(), row);
    }
  }
  const hit = tickerIndex.get(ticker.toUpperCase());
  if (!hit) throw new Error(`No SEC filer found for ticker "${ticker}"`);
  return hit;
}

/** Real web research via Tavily — synthesized answer + current cited sources. */
async function tavilyResearch(query: string): Promise<unknown> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "advanced",
      include_answer: true,
      max_results: 5,
    }),
  });
  if (!res.ok) throw new Error(`Tavily responded ${res.status} ${res.statusText}`);
  const data = (await res.json()) as {
    answer?: string;
    results?: { title?: string; url?: string; content?: string }[];
  };
  const sources = (data.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content,
  }));
  if (!data.answer?.trim() && sources.length === 0) {
    throw new Error(`No research results for "${query}"`);
  }
  return { query, consensus: data.answer, sources, source: "Tavily web research" };
}

/** Fallback research via the DuckDuckGo Instant Answer API (no key, thin). */
async function duckduckgoResearch(query: string): Promise<unknown> {
  const data = (await getJson(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`,
  )) as { Abstract?: string; AbstractURL?: string; Heading?: string; RelatedTopics?: unknown[] };
  const sources = (data.RelatedTopics ?? [])
    .filter((t): t is { Text: string } => typeof (t as { Text?: unknown }).Text === "string")
    .slice(0, 5)
    .map((t) => t.Text);
  if (!data.Abstract?.trim() && sources.length === 0) {
    throw new Error(`No research results for "${query}"`);
  }
  return {
    subject: data.Heading,
    consensus: data.Abstract,
    primarySource: data.AbstractURL,
    supportingSources: sources,
  };
}

export const vendors: Vendor[] = [
  {
    id: "entity-brief",
    name: "Entity Brief",
    description:
      "A desk-ready profile of a company, person, place, or concept — what it is, how it's classified, and the background a researcher needs before going deeper.",
    priceBaseUnits: 1000,
    inputSchema: { topic: "string — the entity to profile, e.g. 'Circle (company)'" },
    async fetch(input) {
      const topic = str(input, "topic");
      const data = (await getJson(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`,
      )) as { title?: string; description?: string; extract?: string };
      if (!data.extract?.trim()) {
        throw new Error(`No profile found for "${topic}"`);
      }
      return {
        entity: data.title,
        classification: data.description ?? "uncategorized",
        brief: data.extract,
        source: "Reference corpus",
      };
    },
  },
  {
    id: "deep-research",
    name: "Deep Research",
    description:
      "A premium web research pull: a synthesized answer to the query plus the current, cited sources it rests on. For questions a static fact won't answer.",
    priceBaseUnits: 5000,
    inputSchema: { query: "string — the research question to investigate" },
    async fetch(input) {
      const query = str(input, "query");
      return process.env.TAVILY_API_KEY ? tavilyResearch(query) : duckduckgoResearch(query);
    },
  },
  {
    id: "market-data",
    name: "Market Data Terminal",
    description:
      "Real-time pricing for a crypto asset — last price, 24h range, volume, and market cap. The feed behind a paid terminal, billed by the call.",
    priceBaseUnits: 2000,
    inputSchema: { asset: "string — the asset id, e.g. 'bitcoin' or 'ethereum'" },
    async fetch(input) {
      const asset = str(input, "asset").toLowerCase();
      const rows = (await getJson(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd" +
          `&ids=${encodeURIComponent(asset)}`,
      )) as {
        current_price?: number;
        market_cap?: number;
        total_volume?: number;
        high_24h?: number;
        low_24h?: number;
        price_change_percentage_24h?: number;
      }[];
      const row = rows[0];
      if (!row) throw new Error(`No market data for asset "${asset}"`);
      return {
        asset,
        priceUsd: row.current_price,
        change24hPct: row.price_change_percentage_24h,
        high24hUsd: row.high_24h,
        low24hUsd: row.low_24h,
        volume24hUsd: row.total_volume,
        marketCapUsd: row.market_cap,
      };
    },
  },
  {
    id: "signal-feed",
    name: "Signal Feed",
    description:
      "Live attention on a topic — what's being discussed right now, ranked by traction. For reading momentum, not history.",
    priceBaseUnits: 4000,
    inputSchema: { topic: "string — the topic to read attention signal on" },
    async fetch(input) {
      const topic = str(input, "topic");
      const data = (await getJson(
        `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(topic)}` +
          "&tags=story&hitsPerPage=6",
      )) as { hits?: { title?: string; url?: string; points?: number; created_at?: string }[] };
      const signals = (data.hits ?? []).map((h) => ({
        headline: h.title,
        link: h.url,
        traction: h.points,
        surfacedAt: h.created_at,
      }));
      if (signals.length === 0) throw new Error(`No attention signal for "${topic}"`);
      return { topic, signals };
    },
  },
  {
    id: "location-intel",
    name: "Location Intelligence",
    description:
      "Resolves any named place to precise coordinates and returns its live operating conditions — for decisions that depend on where and when.",
    priceBaseUnits: 3000,
    inputSchema: { place: "string — a city or place name" },
    async fetch(input) {
      const place = str(input, "place");
      const geo = (await getJson(
        `https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(place)}`,
      )) as { results?: { latitude: number; longitude: number; name: string; country?: string }[] };
      const hit = geo.results?.[0];
      if (!hit) throw new Error(`Could not resolve place "${place}"`);
      const weather = (await getJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}` +
          `&longitude=${hit.longitude}&current=temperature_2m,wind_speed_10m`,
      )) as { current?: { temperature_2m?: number; wind_speed_10m?: number } };
      return {
        location: `${hit.name}, ${hit.country ?? ""}`.trim(),
        coordinates: { latitude: hit.latitude, longitude: hit.longitude },
        conditions: {
          temperatureC: weather.current?.temperature_2m,
          windSpeedKmh: weather.current?.wind_speed_10m,
        },
      };
    },
  },
  {
    id: "scholar-index",
    name: "Scholar Index",
    description:
      "Peer-reviewed evidence on a claim or topic — the works other researchers cite, with venue, year, and citation count. For questions that turn on what the literature actually says.",
    priceBaseUnits: 6000,
    inputSchema: { query: "string — the claim or topic to find evidence for" },
    async fetch(input) {
      const query = str(input, "query");
      const data = (await getJson(
        `https://api.openalex.org/works?search=${encodeURIComponent(query)}` +
          "&per-page=5&select=title,publication_year,cited_by_count,doi," +
          "primary_location,authorships",
      )) as {
        results?: {
          title?: string;
          publication_year?: number;
          cited_by_count?: number;
          doi?: string;
          primary_location?: { source?: { display_name?: string } };
          authorships?: { author?: { display_name?: string } }[];
        }[];
      };
      const works = (data.results ?? []).map((w) => ({
        title: w.title,
        year: w.publication_year,
        venue: w.primary_location?.source?.display_name,
        citedBy: w.cited_by_count,
        authors: (w.authorships ?? [])
          .slice(0, 3)
          .map((a) => a.author?.display_name)
          .filter((n): n is string => typeof n === "string"),
        doi: w.doi,
      }));
      if (works.length === 0) throw new Error(`No peer-reviewed works for "${query}"`);
      return { query, works, source: "OpenAlex" };
    },
  },
  {
    id: "filings-desk",
    name: "Filings Desk",
    description:
      "Recent SEC filings for a public company — 10-K, 10-Q, 8-K — with filing date, form type, and a link to the primary document. For questions about what an issuer has actually disclosed.",
    priceBaseUnits: 8000,
    inputSchema: { ticker: "string — the stock ticker, e.g. 'AAPL' or 'CRCL'" },
    async fetch(input) {
      const ticker = str(input, "ticker").toUpperCase();
      const filer = await resolveCik(ticker);
      const cik10 = String(filer.cik_str).padStart(10, "0");
      const data = (await getJson(
        `https://data.sec.gov/submissions/CIK${cik10}.json`,
        { "User-Agent": SEC_USER_AGENT },
      )) as {
        name?: string;
        recent?: unknown;
        filings?: {
          recent?: {
            accessionNumber?: string[];
            filingDate?: string[];
            form?: string[];
            primaryDocument?: string[];
          };
        };
      };
      const recent = data.filings?.recent;
      const accessions = recent?.accessionNumber ?? [];
      const filings = accessions.slice(0, 5).map((accession, i) => {
        const cleaned = accession.replace(/-/g, "");
        const doc = recent?.primaryDocument?.[i];
        return {
          form: recent?.form?.[i],
          filedOn: recent?.filingDate?.[i],
          accessionNumber: accession,
          documentUrl: doc
            ? `https://www.sec.gov/Archives/edgar/data/${filer.cik_str}/${cleaned}/${doc}`
            : undefined,
        };
      });
      return { ticker, issuer: data.name ?? filer.title, filings, source: "SEC EDGAR" };
    },
  },
];

export const vendorById = (id: string): Vendor | undefined =>
  vendors.find((v) => v.id === id);
