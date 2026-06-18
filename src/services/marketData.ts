import { demoAssets, demoNews, providerHealth } from "../data/fixtures";
import type { Asset, AssetType, Bar, DataStatus, MarketMeta, NewsItem } from "../types";

export type MarketProvider =
  | "Finnhub"
  | "Twelve Data"
  | "Alpha Vantage"
  | "CoinGecko"
  | "Cached data"
  | "Demo Fixture Provider"
  | "Alpaca"
  | "Massive"
  | "Local Collector"
  | "Supabase Collector"
  | (string & {});

export interface ProviderAttempt {
  provider: MarketProvider;
  status: "success" | "missing-key" | "not-found" | "rate-limited" | "provider-error" | "timeout" | "skipped";
  message: string;
}

export interface CacheInfo {
  hit: boolean;
  stale: boolean;
  ttlSeconds: number;
}

export interface ApiQuote {
  symbol: string;
  name: string;
  type: AssetType;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  timestamp: string;
  provider: MarketProvider;
  dataStatus: DataStatus;
  marketStatus: MarketMeta["marketStatus"];
  currency: "USD";
}

export interface QuoteEnvelope {
  quote: ApiQuote;
  generatedAt: string;
  cache: CacheInfo;
  attempts: ProviderAttempt[];
}

export interface HistoryEnvelope {
  symbol: string;
  range: string;
  interval: string;
  candles: Bar[];
  provider: MarketProvider;
  dataStatus: DataStatus;
  dataShape: "ohlc" | "price-series";
  actualRange: {
    start: string | null;
    end: string | null;
    points: number;
  };
  note?: string;
  generatedAt: string;
  cache: CacheInfo;
  attempts: ProviderAttempt[];
}

export interface SearchResult {
  symbol: string;
  name: string;
  type: AssetType;
  exchange?: string;
  provider: MarketProvider;
  dataStatus: DataStatus;
}

export interface SearchEnvelope {
  query: string;
  results: SearchResult[];
  generatedAt: string;
  cache: CacheInfo;
  attempts: ProviderAttempt[];
}

export interface MarketSnapshotEnvelope {
  assets: Asset[];
  news: NewsItem[];
  status: RuntimeStatus;
  providerHealth: typeof providerHealth;
  generatedAt: string;
  cache: CacheInfo;
}

export interface RuntimeStatus {
  mode: "live" | "mixed" | "cached" | "demo" | "unavailable";
  applicationMode: "Live" | "Mixed" | "Cached" | "Demo" | "Unavailable";
  demoMode: boolean;
  generatedAt: string;
  marketStatus: MarketMeta["marketStatus"];
  stockMarketStatus: Exclude<MarketMeta["marketStatus"], "Continuous">;
  cryptoMarketStatus: "Continuous";
  cronSchedule: {
    path: string;
    expression: string;
    description: string;
  };
  cacheBackend: {
    kind: "per-instance-memory";
    durable: false;
    note: string;
  };
  cachePolicy: Record<string, string>;
  supabasePublicConfigured: boolean;
  supabaseServerConfigured: boolean;
  cronSecretConfigured: boolean;
  providers: Array<{
    name: MarketProvider;
    configured: boolean;
    serverSideOnly: boolean;
    status: string;
    supports: string[];
    lastSuccessfulRequest: string | null;
    lastFailedRequest: string | null;
    currentError: string | null;
    rateLimitState: "unknown" | "ok" | "limited";
    dataFreshness: "real-time" | "near-real-time" | "delayed" | "end-of-day" | "cached" | "demo" | "unavailable" | "timing-not-guaranteed";
    fallbackActive: boolean;
    cacheHitRate: number | null;
    averageResponseTimeMs: number | null;
  }>;
  requiredEnvironment: Array<{ name: string; configured: boolean; public: boolean }>;
  routes: string[];
  fixtureCounts: {
    assets: number;
    news: number;
    providerHealth: number;
  };
  collector?: {
    status: "online" | "starting" | "paused" | "paused_quiet_hours" | "delayed" | "offline" | "manually_stopped" | "crashed" | "shutting_down" | "unavailable";
    label: string;
    message: string;
    lastHeartbeat: string | null;
    heartbeatAgeSeconds: number | null;
    lastSuccessfulUpdate: string | null;
    lastBroadScan: string | null;
    lastPriorityScan: string | null;
    websocketStatus: string | null;
    liveSymbolCount: number;
    assetsStored: number;
    latestQuotesStored: number;
    assetsScanned: number;
    recordsWritten: number;
    currentJob: string | null;
    lastError: string | null;
  };
  marketCoverage?: {
    marketUniverse: number;
    broadScanner: string;
    priorityScanner: string;
    liveScanner: string;
    lastCompleteBroadScan: string | null;
    source: string;
  };
}

type ErrorCode = "missing-key" | "not-found" | "rate-limited" | "provider-error" | "timeout";

class MarketDataError extends Error {
  code: ErrorCode;
  provider: MarketProvider;

  constructor(provider: MarketProvider, code: ErrorCode, message: string) {
    super(message);
    this.provider = provider;
    this.code = code;
  }
}

const stockUniverse = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "SPY", "QQQ", "DIA", "IWM"];
const cryptoUniverse = ["bitcoin", "ethereum", "solana"];
const quoteTtlMs = 45_000;
const cryptoQuoteTtlMs = 45_000;
const marketsTtlMs = 120_000;
const historyTtlMs = 900_000;
const newsTtlMs = 900_000;
const searchTtlMs = 86_400_000;

const applicationModeLabel = (mode: RuntimeStatus["mode"]): RuntimeStatus["applicationMode"] => {
  if (mode === "live") return "Live";
  if (mode === "mixed") return "Mixed";
  if (mode === "cached") return "Cached";
  if (mode === "unavailable") return "Unavailable";
  return "Demo";
};

const requiredEnvironment = [
  { name: "NEXT_PUBLIC_APP_URL", public: true },
  { name: "NEXT_PUBLIC_SUPABASE_URL", public: true },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", public: true },
  { name: "SUPABASE_URL", public: false },
  { name: "SUPABASE_ANON_KEY", public: false },
  { name: "SUPABASE_SERVICE_ROLE_KEY", public: false },
  { name: "FINNHUB_API_KEY", public: false },
  { name: "TWELVE_DATA_API_KEY", public: false },
  { name: "ALPHA_VANTAGE_API_KEY", public: false },
  { name: "COINGECKO_API_KEY", public: false },
  { name: "NEWS_API_KEY", public: false },
  { name: "CRON_SECRET", public: false },
  { name: "MARKET_DATA_PROVIDER", public: false },
  { name: "NEWS_DATA_PROVIDER", public: false },
  { name: "WEBSITE_DIRECT_PROVIDER_FALLBACK", public: false }
];

export const directProviderFallbackEnabled = () => process.env.WEBSITE_DIRECT_PROVIDER_FALLBACK === "true";

const cache = new Map<string, { value: unknown; expiresAt: number; writtenAt: number; ttlMs: number }>();
const pending = new Map<string, Promise<unknown>>();

const nowIso = () => new Date().toISOString();
const numberOr = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};
const safeText = (value: unknown) => (typeof value === "string" ? value : "");
const normalizeSymbol = (symbol: string) => symbol.trim().toUpperCase();
const normalizeAlphaTime = (value: string) => {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})$/);
  if (!match) return nowIso();
  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}-04:00`;
};

const cryptoById: Record<string, { symbol: string; name: string }> = {
  bitcoin: { symbol: "BTC-USD", name: "Bitcoin" },
  ethereum: { symbol: "ETH-USD", name: "Ethereum" },
  solana: { symbol: "SOL-USD", name: "Solana" }
};

const cryptoIdFromSymbol = (symbol: string) => {
  const upper = normalizeSymbol(symbol).replace("-USD", "");
  if (upper === "BTC" || upper === "BTCUSD") return "bitcoin";
  if (upper === "ETH" || upper === "ETHUSD") return "ethereum";
  if (upper === "SOL" || upper === "SOLUSD") return "solana";
  return symbol.toLowerCase();
};

export const cryptoIdForSymbol = cryptoIdFromSymbol;

const demoAssetForSymbol = (symbol: string) =>
  demoAssets.find((asset) => asset.symbol.toUpperCase() === normalizeSymbol(symbol) || asset.symbol.replace("-USD", "").toUpperCase() === normalizeSymbol(symbol));

const demoCryptoForId = (id: string) => {
  const mapped = cryptoById[id.toLowerCase()];
  return mapped ? demoAssetForSymbol(mapped.symbol) : undefined;
};

const getCache = <T>(key: string, allowStale = false) => {
  const entry = cache.get(key);
  if (!entry) return null;
  const stale = Date.now() > entry.expiresAt;
  if (stale && !allowStale) return null;
  return {
    value: entry.value as T,
    cache: {
      hit: true,
      stale,
      ttlSeconds: Math.max(0, Math.round((entry.expiresAt - Date.now()) / 1000))
    }
  };
};

const setCache = <T>(key: string, value: T, ttlMs: number) => {
  cache.set(key, { value, ttlMs, writtenAt: Date.now(), expiresAt: Date.now() + ttlMs });
  return value;
};

const dedupe = async <T>(key: string, task: () => Promise<T>) => {
  const existing = pending.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = task().finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
};

const sanitizeProviderError = (provider: MarketProvider, error: unknown): ProviderAttempt => {
  if (error instanceof MarketDataError) {
    return {
      provider,
      status: error.code === "rate-limited" ? "rate-limited" : error.code,
      message: error.message
    };
  }
  return { provider, status: "provider-error", message: "Provider request failed without exposing private details." };
};

const providerEnv = {
  finnhub: () => process.env.FINNHUB_API_KEY || "",
  twelveData: () => process.env.TWELVE_DATA_API_KEY || "",
  alphaVantage: () => process.env.ALPHA_VANTAGE_API_KEY || "",
  coinGecko: () => process.env.COINGECKO_API_KEY || ""
};

const fetchJson = async <T>(provider: MarketProvider, url: string, headers?: Record<string, string>, timeoutMs = 6500): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...headers
      },
      signal: controller.signal
    });

    if (response.status === 404) throw new MarketDataError(provider, "not-found", "Symbol was not found by the provider.");
    if (response.status === 429) throw new MarketDataError(provider, "rate-limited", "Provider rate limit reached; cached or fallback data was used.");
    if (response.status === 401 || response.status === 403) throw new MarketDataError(provider, "provider-error", "Provider rejected the configured API key.");
    if (!response.ok) throw new MarketDataError(provider, "provider-error", "Provider returned an unsuccessful response.");

    const payload = (await response.json()) as T;
    const text = JSON.stringify(payload).toLowerCase();
    if (text.includes("rate limit") || text.includes("our standard api rate limit")) {
      throw new MarketDataError(provider, "rate-limited", "Provider rate limit reached; cached or fallback data was used.");
    }
    return payload;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new MarketDataError(provider, "timeout", "Provider timed out; cached or fallback data was used.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const quoteFromAsset = (asset: Asset, provider: MarketProvider = "Demo Fixture Provider", dataStatus: DataStatus = "Demo"): ApiQuote => ({
  symbol: asset.symbol,
  name: asset.name,
  type: asset.type,
  price: asset.price,
  change: asset.change,
  changePercent: asset.changePercent,
  open: asset.open,
  previousClose: asset.previousClose,
  dayHigh: asset.dayHigh,
  dayLow: asset.dayLow,
  volume: asset.volume,
  timestamp: asset.meta.lastUpdated,
  provider,
  dataStatus,
  marketStatus: asset.meta.marketStatus,
  currency: "USD"
});

const assetWithQuote = (asset: Asset, quote: ApiQuote, bars = asset.bars): Asset => {
  const volume = quote.provider === "Demo Fixture Provider" ? asset.volume : quote.volume > 0 ? quote.volume : 0;
  return {
    ...asset,
    price: quote.price,
    change: quote.change,
    changePercent: quote.changePercent,
    open: quote.open || asset.open,
    previousClose: quote.previousClose || asset.previousClose,
    dayHigh: quote.dayHigh || asset.dayHigh,
    dayLow: quote.dayLow || asset.dayLow,
    volume,
    relativeVolume: volume && asset.averageVolume ? Number((volume / asset.averageVolume).toFixed(2)) : 0,
    bars,
    meta: {
      ...asset.meta,
      provider: quote.provider,
      lastUpdated: quote.timestamp,
      providerTimestamp: quote.timestamp,
      ingestionTimestamp: nowIso(),
      dataStatus: quote.dataStatus,
      marketStatus: quote.marketStatus
    },
    prediction: {
      ...asset.prediction,
      createdAt: quote.timestamp
    }
  };
};

const candlesForRange = (bars: Bar[], range: string) => {
  const upper = range.toUpperCase();
  const sizes: Record<string, number> = {
    "1D": 2,
    "5D": 5,
    "1M": 22,
    "3M": 66,
    "6M": 132,
    YTD: 180,
    "1Y": 252,
    "5Y": 1260,
    MAX: bars.length
  };
  return bars.slice(-Math.min(sizes[upper] ?? 252, bars.length));
};

export const normalizeHistoryRequest = (rangeInput = "1Y", intervalInput?: string) => {
  const range = rangeInput.toUpperCase();
  const allowedRange = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "MAX"].includes(range) ? range : "1Y";
  const ytdDays = Math.max(1, Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86_400_000));
  const config: Record<string, { interval: string; finnhubResolution: string; twelveInterval: string; days: number; outputSize: number }> = {
    "1D": { interval: "5m", finnhubResolution: "5", twelveInterval: "5min", days: 1, outputSize: 390 },
    "5D": { interval: "30m", finnhubResolution: "30", twelveInterval: "30min", days: 5, outputSize: 390 },
    "1M": { interval: "1h", finnhubResolution: "60", twelveInterval: "1h", days: 31, outputSize: 744 },
    "3M": { interval: "1D", finnhubResolution: "D", twelveInterval: "1day", days: 93, outputSize: 93 },
    "6M": { interval: "1D", finnhubResolution: "D", twelveInterval: "1day", days: 183, outputSize: 183 },
    YTD: { interval: "1D", finnhubResolution: "D", twelveInterval: "1day", days: ytdDays, outputSize: ytdDays },
    "1Y": { interval: "1D", finnhubResolution: "D", twelveInterval: "1day", days: 370, outputSize: 370 },
    "5Y": { interval: "1W", finnhubResolution: "W", twelveInterval: "1week", days: 1825, outputSize: 1300 },
    MAX: { interval: "1M", finnhubResolution: "M", twelveInterval: "1month", days: 3650, outputSize: 1200 }
  };
  const fallback = config[allowedRange];
  const requestedInterval = intervalInput?.trim();
  return {
    range: allowedRange,
    interval: requestedInterval || fallback.interval,
    finnhubResolution: fallback.finnhubResolution,
    twelveInterval: fallback.twelveInterval,
    days: fallback.days,
    outputSize: fallback.outputSize
  };
};

const dedupeCandles = (bars: Bar[]) =>
  [...new Map(bars.filter((bar) => bar.time && Number.isFinite(bar.close)).map((bar) => [bar.time, bar])).values()].sort((a, b) => a.time.localeCompare(b.time));

const actualRange = (candles: Bar[]) => ({
  start: candles[0]?.time ?? null,
  end: candles[candles.length - 1]?.time ?? null,
  points: candles.length
});

const demoHistory = (symbol: string, range: string, interval: string, attempts: ProviderAttempt[] = []): HistoryEnvelope => {
  const asset = demoAssetForSymbol(symbol);
  if (!asset) throw new MarketDataError("Demo Fixture Provider", "not-found", "Symbol is not available in Demo Mode.");
  const candles = candlesForRange(asset.bars, range);
  return {
    symbol: asset.symbol,
    range,
    interval,
    candles,
    provider: "Demo Fixture Provider",
    dataStatus: "Demo",
    dataShape: "ohlc",
    actualRange: actualRange(candles),
    note: "Demo fixtures are stored daily bars. Short intraday ranges show available daily fallback data only.",
    generatedAt: nowIso(),
    cache: { hit: false, stale: false, ttlSeconds: 0 },
    attempts
  };
};

const demoQuote = (symbol: string, attempts: ProviderAttempt[] = []): QuoteEnvelope => {
  const asset = demoAssetForSymbol(symbol);
  if (!asset) throw new MarketDataError("Demo Fixture Provider", "not-found", "Symbol is not available in Demo Mode.");
  return {
    quote: quoteFromAsset(asset),
    generatedAt: nowIso(),
    cache: { hit: false, stale: false, ttlSeconds: 0 },
    attempts
  };
};

const missingKey = (provider: MarketProvider, envName: string) =>
  new MarketDataError(provider, "missing-key", `${envName} is not configured in Vercel/server environment variables.`);

const nthWeekdayOfMonth = (year: number, month: number, weekday: number, nth: number) => {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return 1 + offset + (nth - 1) * 7;
};

const lastWeekdayOfMonth = (year: number, month: number, weekday: number) => {
  const last = new Date(Date.UTC(year, month + 1, 0));
  return last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7);
};

const observedDate = (year: number, month: number, day: number) => {
  const date = new Date(Date.UTC(year, month, day));
  const weekday = date.getUTCDay();
  if (weekday === 0) return `${year}-${String(month + 1).padStart(2, "0")}-${String(day + 1).padStart(2, "0")}`;
  if (weekday === 6) return `${year}-${String(month + 1).padStart(2, "0")}-${String(day - 1).padStart(2, "0")}`;
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const easterDate = (year: number) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month, day));
};

const marketHolidayDates = (year: number) => {
  const easter = easterDate(year);
  const goodFriday = new Date(easter);
  goodFriday.setUTCDate(easter.getUTCDate() - 2);
  const fmt = (month: number, day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return new Set([
    observedDate(year, 0, 1),
    fmt(0, nthWeekdayOfMonth(year, 0, 1, 3)),
    fmt(1, nthWeekdayOfMonth(year, 1, 1, 3)),
    goodFriday.toISOString().slice(0, 10),
    fmt(4, lastWeekdayOfMonth(year, 4, 1)),
    observedDate(year, 5, 19),
    observedDate(year, 6, 4),
    fmt(8, nthWeekdayOfMonth(year, 8, 1, 1)),
    fmt(10, nthWeekdayOfMonth(year, 10, 4, 4)),
    observedDate(year, 11, 25)
  ]);
};

export const marketStatusNow = (date = new Date()): Exclude<MarketMeta["marketStatus"], "Continuous"> => {
  const eastern = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const weekday = eastern.find((part) => part.type === "weekday")?.value;
  const year = Number(eastern.find((part) => part.type === "year")?.value ?? "0");
  const month = eastern.find((part) => part.type === "month")?.value ?? "01";
  const day = eastern.find((part) => part.type === "day")?.value ?? "01";
  const hour = Number(eastern.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(eastern.find((part) => part.type === "minute")?.value ?? "0");
  const minutes = hour * 60 + minute;
  if (weekday === "Sat" || weekday === "Sun") return "Closed";
  if (marketHolidayDates(year).has(`${year}-${month}-${day}`)) return "Closed";
  if (minutes < 570) return "Pre-market";
  if (minutes >= 960 && minutes < 1200) return "After-hours";
  if (minutes >= 570 && minutes < 960) return "Open";
  return "Closed";
};

const providerStatus = () => [
  {
    name: "Finnhub" as const,
    configured: Boolean(providerEnv.finnhub()),
    serverSideOnly: true,
    status: providerEnv.finnhub() ? "Configured server-side" : "Missing FINNHUB_API_KEY",
    supports: ["stock quotes", "stock candles", "symbol search", "company news"],
    lastSuccessfulRequest: null,
    lastFailedRequest: null,
    currentError: providerEnv.finnhub() ? null : "FINNHUB_API_KEY is missing.",
    rateLimitState: "unknown" as const,
    dataFreshness: providerEnv.finnhub() ? ("timing-not-guaranteed" as const) : ("unavailable" as const),
    fallbackActive: !providerEnv.finnhub(),
    cacheHitRate: null,
    averageResponseTimeMs: null
  },
  {
    name: "Twelve Data" as const,
    configured: Boolean(providerEnv.twelveData()),
    serverSideOnly: true,
    status: providerEnv.twelveData() ? "Configured server-side" : "Missing TWELVE_DATA_API_KEY",
    supports: ["stock quotes", "stock candles", "symbol search"],
    lastSuccessfulRequest: null,
    lastFailedRequest: null,
    currentError: providerEnv.twelveData() ? null : "TWELVE_DATA_API_KEY is missing.",
    rateLimitState: "unknown" as const,
    dataFreshness: providerEnv.twelveData() ? ("timing-not-guaranteed" as const) : ("unavailable" as const),
    fallbackActive: !providerEnv.twelveData(),
    cacheHitRate: null,
    averageResponseTimeMs: null
  },
  {
    name: "Alpha Vantage" as const,
    configured: Boolean(providerEnv.alphaVantage()),
    serverSideOnly: true,
    status: providerEnv.alphaVantage() ? "Configured server-side" : "Missing ALPHA_VANTAGE_API_KEY",
    supports: ["stock quotes", "daily history", "symbol search", "news sentiment"],
    lastSuccessfulRequest: null,
    lastFailedRequest: null,
    currentError: providerEnv.alphaVantage() ? null : "ALPHA_VANTAGE_API_KEY is missing.",
    rateLimitState: "unknown" as const,
    dataFreshness: providerEnv.alphaVantage() ? ("end-of-day" as const) : ("unavailable" as const),
    fallbackActive: !providerEnv.alphaVantage(),
    cacheHitRate: null,
    averageResponseTimeMs: null
  },
  {
    name: "CoinGecko" as const,
    configured: true,
    serverSideOnly: true,
    status: providerEnv.coinGecko() ? "Configured with API key" : "Using public CoinGecko endpoint; add COINGECKO_API_KEY for higher limits",
    supports: ["crypto quotes", "crypto market charts"],
    lastSuccessfulRequest: null,
    lastFailedRequest: null,
    currentError: null,
    rateLimitState: "unknown" as const,
    dataFreshness: "near-real-time" as const,
    fallbackActive: false,
    cacheHitRate: null,
    averageResponseTimeMs: null
  }
];

export const getRuntimeStatus = (): RuntimeStatus => {
  const providers = providerStatus();
  const stockConfigured = providers.some((provider) => provider.name !== "CoinGecko" && provider.configured);
  const mode: RuntimeStatus["mode"] = stockConfigured ? "mixed" : "demo";
  const stockMarketStatus = marketStatusNow();
  return {
    mode,
    applicationMode: applicationModeLabel(mode),
    demoMode: !stockConfigured,
    generatedAt: nowIso(),
    marketStatus: stockMarketStatus,
    stockMarketStatus,
    cryptoMarketStatus: "Continuous",
    cronSchedule: {
      path: "/api/ingest",
      expression: "0 9 * * *",
      description: "Backend ingestion scheduled daily at 09:00 UTC."
    },
    cacheBackend: {
      kind: "per-instance-memory",
      durable: false,
      note: "Serverless memory cache is per Vercel instance. It deduplicates and serves stale fallback locally, but it is not a global durable cache."
    },
    cachePolicy: {
      stockQuotes: "30-60 seconds",
      cryptoQuotes: "30-60 seconds",
      dashboard: "1-5 minutes",
      historicalCharts: "5-30 minutes",
      news: "10-30 minutes",
      symbolSearch: "24 hours"
    },
    supabasePublicConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServerConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET),
    providers,
    requiredEnvironment: requiredEnvironment.map((item) => ({ ...item, configured: Boolean(process.env[item.name]) })),
    routes: [
      "/api/markets",
      "/api/quote?symbol=AAPL",
      "/api/history?symbol=AAPL&range=1Y&interval=1D",
      "/api/search?q=Apple",
      "/api/news?symbol=AAPL",
      "/api/status",
      "/api/crypto/quote?id=bitcoin",
      "/api/crypto/history?id=bitcoin&range=1Y",
      "/api/alerts",
      "/api/ingest",
      "/api/admin/diagnostics"
    ],
    fixtureCounts: {
      assets: demoAssets.length,
      news: demoNews.length,
      providerHealth: providerHealth.length
    }
  };
};

const finnhubQuote = async (symbol: string): Promise<ApiQuote> => {
  const key = providerEnv.finnhub();
  if (!key) throw missingKey("Finnhub", "FINNHUB_API_KEY");
  const payload = await fetchJson<Record<string, number>>("Finnhub", `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(key)}`);
  const current = numberOr(payload.c);
  if (current <= 0) throw new MarketDataError("Finnhub", "not-found", "Finnhub did not return a current price for this symbol.");
  const base = demoAssetForSymbol(symbol);
  return {
    symbol,
    name: base?.name ?? symbol,
    type: base?.type ?? "stock",
    price: current,
    change: numberOr(payload.d),
    changePercent: numberOr(payload.dp),
    open: numberOr(payload.o, base?.open ?? current),
    previousClose: numberOr(payload.pc, base?.previousClose ?? current),
    dayHigh: numberOr(payload.h, base?.dayHigh ?? current),
    dayLow: numberOr(payload.l, base?.dayLow ?? current),
    volume: base?.volume ?? 0,
    timestamp: payload.t ? new Date(numberOr(payload.t) * 1000).toISOString() : nowIso(),
    provider: "Finnhub",
    dataStatus: "Delayed",
    marketStatus: marketStatusNow(),
    currency: "USD"
  };
};

const twelveQuote = async (symbol: string): Promise<ApiQuote> => {
  const key = providerEnv.twelveData();
  if (!key) throw missingKey("Twelve Data", "TWELVE_DATA_API_KEY");
  const payload = await fetchJson<Record<string, unknown>>("Twelve Data", `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`);
  if (payload.status === "error") throw new MarketDataError("Twelve Data", "provider-error", safeText(payload.message) || "Twelve Data returned an error.");
  const close = numberOr(payload.close || payload.price);
  if (close <= 0) throw new MarketDataError("Twelve Data", "not-found", "Twelve Data did not return a close price for this symbol.");
  const base = demoAssetForSymbol(symbol);
  return {
    symbol,
    name: safeText(payload.name) || base?.name || symbol,
    type: base?.type ?? "stock",
    price: close,
    change: numberOr(payload.change),
    changePercent: numberOr(payload.percent_change),
    open: numberOr(payload.open, base?.open ?? close),
    previousClose: numberOr(payload.previous_close, base?.previousClose ?? close),
    dayHigh: numberOr(payload.high, base?.dayHigh ?? close),
    dayLow: numberOr(payload.low, base?.dayLow ?? close),
    volume: numberOr(payload.volume, base?.volume ?? 0),
    timestamp: payload.timestamp ? new Date(numberOr(payload.timestamp) * 1000).toISOString() : nowIso(),
    provider: "Twelve Data",
    dataStatus: "Delayed",
    marketStatus: marketStatusNow(),
    currency: "USD"
  };
};

const alphaQuote = async (symbol: string): Promise<ApiQuote> => {
  const key = providerEnv.alphaVantage();
  if (!key) throw missingKey("Alpha Vantage", "ALPHA_VANTAGE_API_KEY");
  const payload = await fetchJson<Record<string, Record<string, string>>>("Alpha Vantage", `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`);
  const quote = payload["Global Quote"];
  if (!quote || !Object.keys(quote).length) throw new MarketDataError("Alpha Vantage", "not-found", "Alpha Vantage did not return a quote for this symbol.");
  const price = numberOr(quote["05. price"]);
  const previousClose = numberOr(quote["08. previous close"], price);
  const base = demoAssetForSymbol(symbol);
  return {
    symbol,
    name: base?.name ?? symbol,
    type: base?.type ?? "stock",
    price,
    change: numberOr(quote["09. change"]),
    changePercent: numberOr(quote["10. change percent"]?.replace("%", "")),
    open: numberOr(quote["02. open"], base?.open ?? price),
    previousClose,
    dayHigh: numberOr(quote["03. high"], base?.dayHigh ?? price),
    dayLow: numberOr(quote["04. low"], base?.dayLow ?? price),
    volume: numberOr(quote["06. volume"], base?.volume ?? 0),
    timestamp: quote["07. latest trading day"] ? `${quote["07. latest trading day"]}T16:00:00-04:00` : nowIso(),
    provider: "Alpha Vantage",
    dataStatus: "Delayed",
    marketStatus: marketStatusNow(),
    currency: "USD"
  };
};

const resolveStockQuoteFresh = async (symbol: string, attempts: ProviderAttempt[]): Promise<ApiQuote> => {
  for (const [provider, task] of [
    ["Finnhub", finnhubQuote],
    ["Twelve Data", twelveQuote],
    ["Alpha Vantage", alphaQuote]
  ] as const) {
    try {
      const quote = await task(symbol);
      attempts.push({ provider, status: "success", message: "Provider returned a normalized quote." });
      return quote;
    } catch (error) {
      attempts.push(sanitizeProviderError(provider, error));
    }
  }
  throw new MarketDataError("Demo Fixture Provider", "provider-error", "No live stock provider returned usable quote data.");
};

export const getStockQuote = async (symbolInput: string, options: { refresh?: boolean; directProviders?: boolean } = {}): Promise<QuoteEnvelope> => {
  const symbol = normalizeSymbol(symbolInput);
  const key = `stock-quote:${symbol}`;
  const cached = !options.refresh ? getCache<QuoteEnvelope>(key) : null;
  if (cached) {
    return {
      ...cached.value,
      generatedAt: nowIso(),
      quote: { ...cached.value.quote, dataStatus: "Cached" },
      cache: cached.cache
    };
  }

  return dedupe(key, async () => {
    const attempts: ProviderAttempt[] = [];
    if (options.directProviders === false) {
      attempts.push({ provider: "Demo Fixture Provider", status: "skipped", message: "Direct public provider fallback is disabled; collector/Supabase data is preferred." });
      return demoQuote(symbol, attempts);
    }
    try {
      const quote = await resolveStockQuoteFresh(symbol, attempts);
      return setCache(
        key,
        {
          quote,
          generatedAt: nowIso(),
          cache: { hit: false, stale: false, ttlSeconds: Math.round(quoteTtlMs / 1000) },
          attempts
        },
        quoteTtlMs
      );
    } catch {
      const stale = getCache<QuoteEnvelope>(key, true);
      if (stale) {
        return {
          ...stale.value,
          generatedAt: nowIso(),
          quote: { ...stale.value.quote, provider: "Cached data", dataStatus: "Cached" },
          cache: { ...stale.cache, stale: true },
          attempts
        };
      }
      return demoQuote(symbol, attempts);
    }
  });
};

const finnhubHistory = async (symbol: string, range: string): Promise<Bar[]> => {
  const key = providerEnv.finnhub();
  if (!key) throw missingKey("Finnhub", "FINNHUB_API_KEY");
  const config = normalizeHistoryRequest(range);
  const to = Math.floor(Date.now() / 1000);
  const from = to - config.days * 24 * 60 * 60;
  const payload = await fetchJson<{ s?: string; t?: number[]; o?: number[]; h?: number[]; l?: number[]; c?: number[]; v?: number[] }>(
    "Finnhub",
    `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${config.finnhubResolution}&from=${from}&to=${to}&token=${encodeURIComponent(key)}`,
    undefined,
    8000
  );
  if (payload.s !== "ok" || !payload.t?.length) throw new MarketDataError("Finnhub", "not-found", "Finnhub did not return candles for this symbol.");
  return dedupeCandles(
    payload.t.map((time, index) => ({
      time: config.finnhubResolution === "D" || config.finnhubResolution === "W" || config.finnhubResolution === "M" ? new Date(time * 1000).toISOString().slice(0, 10) : new Date(time * 1000).toISOString(),
      open: numberOr(payload.o?.[index]),
      high: numberOr(payload.h?.[index]),
      low: numberOr(payload.l?.[index]),
      close: numberOr(payload.c?.[index]),
      volume: Math.round(numberOr(payload.v?.[index]))
    }))
  );
};

const twelveHistory = async (symbol: string, range: string): Promise<Bar[]> => {
  const key = providerEnv.twelveData();
  if (!key) throw missingKey("Twelve Data", "TWELVE_DATA_API_KEY");
  const config = normalizeHistoryRequest(range);
  const payload = await fetchJson<{ status?: string; message?: string; values?: Array<Record<string, string>> }>(
    "Twelve Data",
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${config.twelveInterval}&outputsize=${config.outputSize}&apikey=${encodeURIComponent(key)}`,
    undefined,
    8000
  );
  if (payload.status === "error") throw new MarketDataError("Twelve Data", "provider-error", payload.message || "Twelve Data returned an error.");
  if (!payload.values?.length) throw new MarketDataError("Twelve Data", "not-found", "Twelve Data did not return candles for this symbol.");
  return dedupeCandles(
    payload.values.map((bar) => ({
      time: bar.datetime,
      open: numberOr(bar.open),
      high: numberOr(bar.high),
      low: numberOr(bar.low),
      close: numberOr(bar.close),
      volume: Math.round(numberOr(bar.volume))
    }))
  );
};

const alphaHistory = async (symbol: string): Promise<Bar[]> => {
  const key = providerEnv.alphaVantage();
  if (!key) throw missingKey("Alpha Vantage", "ALPHA_VANTAGE_API_KEY");
  const payload = await fetchJson<{ "Time Series (Daily)"?: Record<string, Record<string, string>> }>("Alpha Vantage", `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=full&apikey=${encodeURIComponent(key)}`, undefined, 8000);
  const series = payload["Time Series (Daily)"];
  if (!series) throw new MarketDataError("Alpha Vantage", "not-found", "Alpha Vantage did not return daily candles for this symbol.");
  return dedupeCandles(
    Object.entries(series).map(([time, bar]) => ({
      time,
      open: numberOr(bar["1. open"]),
      high: numberOr(bar["2. high"]),
      low: numberOr(bar["3. low"]),
      close: numberOr(bar["4. close"]),
      volume: Math.round(numberOr(bar["5. volume"]))
    }))
  );
};

export const getStockHistory = async (symbolInput: string, range = "1Y", interval = "1D", options: { refresh?: boolean; directProviders?: boolean } = {}): Promise<HistoryEnvelope> => {
  const symbol = normalizeSymbol(symbolInput);
  const request = normalizeHistoryRequest(range, interval);
  const key = `stock-history:${symbol}:${request.range}:${request.interval}`;
  const cached = !options.refresh ? getCache<HistoryEnvelope>(key) : null;
  if (cached) return { ...cached.value, generatedAt: nowIso(), dataStatus: "Cached", provider: "Cached data", cache: cached.cache };

  return dedupe(key, async () => {
    const attempts: ProviderAttempt[] = [];
    if (options.directProviders === false) {
      attempts.push({ provider: "Demo Fixture Provider", status: "skipped", message: "Direct public provider fallback is disabled; collector/Supabase data is preferred." });
      return demoHistory(symbol, request.range, request.interval, attempts);
    }
    for (const [provider, task] of [
      ["Finnhub", () => finnhubHistory(symbol, request.range)],
      ["Twelve Data", () => twelveHistory(symbol, request.range)],
      ["Alpha Vantage", () => alphaHistory(symbol)]
    ] as const) {
      try {
        const candles = candlesForRange(await task(), request.range);
        attempts.push({ provider, status: "success", message: "Provider returned normalized historical candles." });
        return setCache(
          key,
          {
            symbol,
            range: request.range,
            interval: request.interval,
            candles,
            provider,
            dataStatus: "Delayed",
            dataShape: "ohlc",
            actualRange: actualRange(candles),
            note: interval === "1D" ? "Daily OHLC candles returned by the active stock provider or fallback provider." : "Range requested with provider-specific intraday interval when supported; fallback providers may return daily candles.",
            generatedAt: nowIso(),
            cache: { hit: false, stale: false, ttlSeconds: Math.round(historyTtlMs / 1000) },
            attempts
          },
          historyTtlMs
        );
      } catch (error) {
        attempts.push(sanitizeProviderError(provider, error));
      }
    }
    const stale = getCache<HistoryEnvelope>(key, true);
    if (stale) return { ...stale.value, provider: "Cached data", dataStatus: "Cached", generatedAt: nowIso(), cache: { ...stale.cache, stale: true }, attempts };
    return demoHistory(symbol, request.range, request.interval, attempts);
  });
};

const coinGeckoHeaders = () => {
  const key = providerEnv.coinGecko();
  return key ? { "x-cg-demo-api-key": key } : undefined;
};

const coinGeckoMarketChartRequest = (request: ReturnType<typeof normalizeHistoryRequest>) => {
  const requestedDays = request.range === "MAX" ? Number.POSITIVE_INFINITY : request.days;
  const days = Math.min(requestedDays, 365);
  return {
    days,
    limited: request.range === "MAX" || requestedDays > days
  };
};

export const getCryptoQuote = async (idInput: string, options: { refresh?: boolean } = {}): Promise<QuoteEnvelope> => {
  const id = idInput.trim().toLowerCase();
  const mapped = cryptoById[id] ?? { symbol: id.toUpperCase(), name: id };
  const key = `crypto-quote:${id}`;
  const cached = !options.refresh ? getCache<QuoteEnvelope>(key) : null;
  if (cached) return { ...cached.value, generatedAt: nowIso(), quote: { ...cached.value.quote, dataStatus: "Cached" }, cache: cached.cache };

  return dedupe(key, async () => {
    const attempts: ProviderAttempt[] = [];
    try {
      const payload = await fetchJson<Record<string, { usd?: number; usd_24h_change?: number; usd_24h_vol?: number; last_updated_at?: number }>>(
        "CoinGecko",
        `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_last_updated_at=true`,
        coinGeckoHeaders()
      );
      const data = payload[id];
      if (!data?.usd) throw new MarketDataError("CoinGecko", "not-found", "CoinGecko did not return a USD price for this coin id.");
      const base = demoCryptoForId(id);
      const changePercent = numberOr(data.usd_24h_change);
      const previousClose = data.usd / (1 + changePercent / 100);
      const quote: ApiQuote = {
        symbol: mapped.symbol,
        name: mapped.name,
        type: "crypto",
        price: Number(data.usd.toFixed(2)),
        change: Number((data.usd - previousClose).toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        open: base?.open ?? previousClose,
        previousClose: Number(previousClose.toFixed(2)),
        dayHigh: base?.dayHigh ?? data.usd,
        dayLow: base?.dayLow ?? previousClose,
        volume: Math.round(numberOr(data.usd_24h_vol, base?.volume ?? 0)),
        timestamp: data.last_updated_at ? new Date(data.last_updated_at * 1000).toISOString() : nowIso(),
        provider: "CoinGecko",
        dataStatus: "Delayed",
        marketStatus: "Continuous",
        currency: "USD"
      };
      attempts.push({ provider: "CoinGecko", status: "success", message: "CoinGecko returned a normalized crypto quote." });
      return setCache(key, { quote, generatedAt: nowIso(), cache: { hit: false, stale: false, ttlSeconds: Math.round(cryptoQuoteTtlMs / 1000) }, attempts }, cryptoQuoteTtlMs);
    } catch (error) {
      attempts.push(sanitizeProviderError("CoinGecko", error));
      const stale = getCache<QuoteEnvelope>(key, true);
      if (stale) return { ...stale.value, quote: { ...stale.value.quote, provider: "Cached data", dataStatus: "Cached" }, generatedAt: nowIso(), cache: { ...stale.cache, stale: true }, attempts };
      const demo = demoCryptoForId(id);
      if (!demo) throw new MarketDataError("Demo Fixture Provider", "not-found", "Crypto id is not supported in Demo Mode.");
      return {
        quote: quoteFromAsset(demo),
        generatedAt: nowIso(),
        cache: { hit: false, stale: false, ttlSeconds: 0 },
        attempts
      };
    }
  });
};

export const getCryptoHistory = async (idInput: string, range = "1Y", options: { refresh?: boolean } = {}): Promise<HistoryEnvelope> => {
  const id = idInput.trim().toLowerCase();
  const mapped = cryptoById[id];
  const request = normalizeHistoryRequest(range);
  const key = `crypto-history:${id}:${request.range}:${request.interval}`;
  const cached = !options.refresh ? getCache<HistoryEnvelope>(key) : null;
  if (cached) return { ...cached.value, generatedAt: nowIso(), dataStatus: "Cached", provider: "Cached data", cache: cached.cache };

  return dedupe(key, async () => {
    const attempts: ProviderAttempt[] = [];
    try {
      const marketChartRequest = coinGeckoMarketChartRequest(request);
      const payload = await fetchJson<{ prices?: Array<[number, number]>; total_volumes?: Array<[number, number]> }>(
        "CoinGecko",
        `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${marketChartRequest.days}&interval=${request.interval === "5m" || request.interval === "30m" || request.interval === "1h" ? "hourly" : "daily"}`,
        coinGeckoHeaders(),
        8000
      );
      if (!payload.prices?.length) throw new MarketDataError("CoinGecko", "not-found", "CoinGecko did not return historical prices for this coin id.");
      const candles = dedupeCandles(
        payload.prices.map(([time, price], index) => {
          const volume = payload.total_volumes?.[index]?.[1] ?? 0;
          return {
            time: new Date(time).toISOString().slice(0, 10),
            open: Number(price.toFixed(2)),
            high: Number(price.toFixed(2)),
            low: Number(price.toFixed(2)),
            close: Number(price.toFixed(2)),
            volume: Math.round(volume)
          };
        })
      );
      attempts.push({ provider: "CoinGecko", status: "success", message: "CoinGecko returned a crypto price series. OHLC candles were not fabricated." });
      return setCache(
        key,
        {
          symbol: mapped?.symbol ?? id.toUpperCase(),
          range: request.range,
          interval: request.interval,
          candles,
          provider: "CoinGecko",
          dataStatus: "Delayed",
          dataShape: "price-series",
          actualRange: actualRange(candles),
          note: `CoinGecko market_chart returns price-series data here, not true OHLC candles. The frontend must display this as a line/area chart only.${marketChartRequest.limited ? ` This endpoint is capped at ${marketChartRequest.days} days, so the actual returned range may be shorter than the requested ${request.range} range.` : ""}`,
          generatedAt: nowIso(),
          cache: { hit: false, stale: false, ttlSeconds: Math.round(historyTtlMs / 1000) },
          attempts
        },
        historyTtlMs
      );
    } catch (error) {
      attempts.push(sanitizeProviderError("CoinGecko", error));
      const stale = getCache<HistoryEnvelope>(key, true);
      if (stale) return { ...stale.value, provider: "Cached data", dataStatus: "Cached", generatedAt: nowIso(), cache: { ...stale.cache, stale: true }, attempts };
      const demo = demoCryptoForId(id);
      if (!demo) throw new MarketDataError("Demo Fixture Provider", "not-found", "Crypto id is not supported in Demo Mode.");
      return demoHistory(demo.symbol, request.range, request.interval, attempts);
    }
  });
};

export const getSearchResults = async (queryInput: string, options: { directProviders?: boolean } = {}): Promise<SearchEnvelope> => {
  const query = queryInput.trim();
  const key = `search:${query.toLowerCase()}`;
  const cached = getCache<SearchEnvelope>(key);
  if (cached) return { ...cached.value, generatedAt: nowIso(), cache: cached.cache };
  const attempts: ProviderAttempt[] = [];
  const results = new Map<string, SearchResult>();

  const addDemoResults = () => {
    const normalized = query.toLowerCase();
    demoAssets
      .filter((asset) => `${asset.symbol} ${asset.name} ${asset.sector} ${asset.type}`.toLowerCase().includes(normalized))
      .forEach((asset) =>
        results.set(asset.symbol, {
          symbol: asset.symbol,
          name: asset.name,
          type: asset.type,
          exchange: asset.exchange,
          provider: "Demo Fixture Provider",
          dataStatus: "Demo"
        })
      );
  };

  if (!query) return { query, results: [], generatedAt: nowIso(), cache: { hit: false, stale: false, ttlSeconds: 0 }, attempts };

  if (options.directProviders !== false) {
    try {
      const keyValue = providerEnv.finnhub();
      if (!keyValue) throw missingKey("Finnhub", "FINNHUB_API_KEY");
      const payload = await fetchJson<{ result?: Array<{ symbol?: string; description?: string; type?: string }> }>("Finnhub", `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${encodeURIComponent(keyValue)}`);
      payload.result?.slice(0, 10).forEach((item) => {
        if (item.symbol) results.set(item.symbol, { symbol: item.symbol, name: item.description || item.symbol, type: "stock", provider: "Finnhub", dataStatus: "Delayed" });
      });
      attempts.push({ provider: "Finnhub", status: "success", message: "Finnhub search returned results." });
    } catch (error) {
      attempts.push(sanitizeProviderError("Finnhub", error));
    }

    try {
      const keyValue = providerEnv.twelveData();
      if (!keyValue) throw missingKey("Twelve Data", "TWELVE_DATA_API_KEY");
      const payload = await fetchJson<{ data?: Array<{ symbol?: string; instrument_name?: string; exchange?: string; instrument_type?: string }> }>("Twelve Data", `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(query)}&apikey=${encodeURIComponent(keyValue)}`);
      payload.data?.slice(0, 10).forEach((item) => {
        if (item.symbol) results.set(item.symbol, { symbol: item.symbol, name: item.instrument_name || item.symbol, type: "stock", exchange: item.exchange, provider: "Twelve Data", dataStatus: "Delayed" });
      });
      attempts.push({ provider: "Twelve Data", status: "success", message: "Twelve Data search returned results." });
    } catch (error) {
      attempts.push(sanitizeProviderError("Twelve Data", error));
    }

    try {
      const keyValue = providerEnv.alphaVantage();
      if (!keyValue) throw missingKey("Alpha Vantage", "ALPHA_VANTAGE_API_KEY");
      const payload = await fetchJson<{ bestMatches?: Array<Record<string, string>> }>("Alpha Vantage", `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${encodeURIComponent(keyValue)}`);
      payload.bestMatches?.slice(0, 10).forEach((item) => {
        const symbol = item["1. symbol"];
        if (symbol) results.set(symbol, { symbol, name: item["2. name"] || symbol, type: "stock", exchange: item["4. region"], provider: "Alpha Vantage", dataStatus: "Delayed" });
      });
      attempts.push({ provider: "Alpha Vantage", status: "success", message: "Alpha Vantage search returned results." });
    } catch (error) {
      attempts.push(sanitizeProviderError("Alpha Vantage", error));
    }
  } else {
    attempts.push({ provider: "Demo Fixture Provider", status: "skipped", message: "Direct public provider search fallback is disabled; collector/Supabase assets are preferred." });
  }

  addDemoResults();
  const envelope = {
    query,
    results: [...results.values()].slice(0, 20),
    generatedAt: nowIso(),
    cache: { hit: false, stale: false, ttlSeconds: Math.round(searchTtlMs / 1000) },
    attempts
  };
  return setCache(key, envelope, searchTtlMs);
};

export const getNews = async (symbolInput?: string, queryInput?: string): Promise<{ news: NewsItem[]; generatedAt: string; cache: CacheInfo; attempts: ProviderAttempt[] }> => {
  const symbol = symbolInput ? normalizeSymbol(symbolInput) : "";
  const query = queryInput?.trim().toLowerCase() ?? "";
  const key = `news:${symbol}:${query}`;
  const cached = getCache<{ news: NewsItem[]; generatedAt: string; cache: CacheInfo; attempts: ProviderAttempt[] }>(key);
  if (cached) return { ...cached.value, generatedAt: nowIso(), cache: cached.cache };
  const attempts: ProviderAttempt[] = [];
  const rows: NewsItem[] = [];

  if (symbol) {
    try {
      const keyValue = providerEnv.finnhub();
      if (!keyValue) throw missingKey("Finnhub", "FINNHUB_API_KEY");
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const payload = await fetchJson<Array<Record<string, unknown>>>("Finnhub", `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${encodeURIComponent(keyValue)}`);
      payload.slice(0, 12).forEach((item, index) => {
        rows.push({
          id: `finnhub-${symbol}-${safeText(item.id) || index}`,
          headline: safeText(item.headline) || "Untitled market news",
          source: safeText(item.source) || "Finnhub",
          publishedAt: item.datetime ? new Date(numberOr(item.datetime) * 1000).toISOString() : nowIso(),
          tone: "Neutral",
          impactScore: 60,
          relatedSymbols: [symbol],
          summary: safeText(item.summary) || "Provider news item.",
          url: safeText(item.url) || undefined,
          provider: "Finnhub",
          dataStatus: "Delayed"
        });
      });
      attempts.push({ provider: "Finnhub", status: "success", message: "Finnhub returned company news." });
    } catch (error) {
      attempts.push(sanitizeProviderError("Finnhub", error));
    }

    try {
      const keyValue = providerEnv.alphaVantage();
      if (!keyValue) throw missingKey("Alpha Vantage", "ALPHA_VANTAGE_API_KEY");
      const payload = await fetchJson<{ feed?: Array<Record<string, unknown>> }>("Alpha Vantage", `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(keyValue)}`);
      payload.feed?.slice(0, 12).forEach((item, index) => {
        rows.push({
          id: `alpha-${symbol}-${index}`,
          headline: safeText(item.title) || "Untitled market news",
          source: safeText(item.source) || "Alpha Vantage",
          publishedAt: normalizeAlphaTime(safeText(item.time_published)),
          tone: numberOr(item.overall_sentiment_score) > 0.1 ? "Positive" : numberOr(item.overall_sentiment_score) < -0.1 ? "Negative" : "Neutral",
          impactScore: Math.min(95, Math.max(35, Math.round(Math.abs(numberOr(item.overall_sentiment_score)) * 100))),
          relatedSymbols: [symbol],
          summary: safeText(item.summary) || "Provider news item.",
          url: safeText(item.url) || undefined,
          provider: "Alpha Vantage",
          dataStatus: "Delayed"
        });
      });
      attempts.push({ provider: "Alpha Vantage", status: "success", message: "Alpha Vantage returned news sentiment." });
    } catch (error) {
      attempts.push(sanitizeProviderError("Alpha Vantage", error));
    }
  }

  const filteredFallback = demoNews.filter((item) => {
    const symbolMatch = symbol ? item.relatedSymbols.includes(symbol) : true;
    const queryMatch = query ? `${item.headline} ${item.summary} ${item.source}`.toLowerCase().includes(query) : true;
    return symbolMatch && queryMatch;
  });
  const fallback = filteredFallback.length
    ? filteredFallback
    : symbol
      ? demoNews.slice(0, 4).map((item) => ({
          ...item,
          id: `${item.id}-${symbol.toLowerCase()}`,
          relatedSymbols: [...new Set([symbol, ...item.relatedSymbols])]
        }))
      : demoNews;

  const news = rows.length
    ? [...new Map(rows.map((item) => [`${item.headline.toLowerCase()}|${item.source.toLowerCase()}`, item])).values()]
    : fallback.map((item) => ({ ...item, provider: item.provider ?? "Demo Fixture Provider", dataStatus: item.dataStatus ?? "Demo" }));
  const envelope = {
    news,
    generatedAt: nowIso(),
    cache: { hit: false, stale: false, ttlSeconds: Math.round(newsTtlMs / 1000) },
    attempts
  };
  return setCache(key, envelope, newsTtlMs);
};

export const getMarketSnapshot = async (options: { refresh?: boolean } = {}): Promise<MarketSnapshotEnvelope> => {
  const key = "markets:overview";
  const cached = !options.refresh ? getCache<MarketSnapshotEnvelope>(key) : null;
  if (cached) return { ...cached.value, generatedAt: nowIso(), cache: cached.cache };

  return dedupe(key, async () => {
    const stockKeysConfigured = directProviderFallbackEnabled() && Boolean(providerEnv.finnhub() || providerEnv.twelveData() || providerEnv.alphaVantage());
    const assets = await Promise.all(
      demoAssets.map(async (asset) => {
        try {
          if (asset.type === "crypto") {
            const quote = await getCryptoQuote(cryptoIdFromSymbol(asset.symbol), options);
            return assetWithQuote(asset, quote.quote);
          }
          if (stockKeysConfigured && stockUniverse.includes(asset.symbol.replace("^", ""))) {
            const quote = await getStockQuote(asset.symbol, options);
            return assetWithQuote(asset, quote.quote);
          }
          return asset;
        } catch {
          return asset;
        }
      })
    );
    const news = (await getNews().catch(() => ({ news: demoNews }))).news;
    const liveCount = assets.filter((asset) => asset.meta.dataStatus === "Live" || asset.meta.dataStatus === "Delayed").length;
    const status = getRuntimeStatus();
    const snapshot: MarketSnapshotEnvelope = {
      assets,
      news,
      status: {
        ...status,
        mode: liveCount === 0 ? "demo" : liveCount === assets.length ? "live" : "mixed",
        demoMode: liveCount === 0
      },
      providerHealth,
      generatedAt: nowIso(),
      cache: { hit: false, stale: false, ttlSeconds: Math.round(marketsTtlMs / 1000) }
    };
    return setCache(key, snapshot, marketsTtlMs);
  });
};

export const applyHistoryToAsset = (asset: Asset, history: HistoryEnvelope): Asset => ({
  ...asset,
  bars: history.candles.length ? history.candles : asset.bars,
  meta: {
    ...asset.meta,
    provider: history.provider,
    dataStatus: history.dataStatus,
    lastUpdated: history.generatedAt,
    providerTimestamp: history.generatedAt,
    ingestionTimestamp: nowIso()
  }
});

export const notFoundResponse = (message: string) => ({
  error: "not_found",
  message
});

export const serverErrorResponse = () => ({
  error: "server_error",
  message: "The request failed without exposing private provider details."
});
