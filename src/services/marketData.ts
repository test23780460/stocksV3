import { demoAssets, demoNews, providerHealth } from "../data/fixtures";
import type { Asset, AssetType, Bar, DataStatus, MarketMeta, NewsItem } from "../types";

export type MarketProvider =
  | "Finnhub"
  | "Twelve Data"
  | "Alpha Vantage"
  | "CoinGecko"
  | "Cached data"
  | "Demo Fixture Provider";

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
  mode: "live" | "mixed" | "demo";
  demoMode: boolean;
  generatedAt: string;
  marketStatus: MarketMeta["marketStatus"];
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
  }>;
  requiredEnvironment: Array<{ name: string; configured: boolean; public: boolean }>;
  routes: string[];
  fixtureCounts: {
    assets: number;
    news: number;
    providerHealth: number;
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

const requiredEnvironment = [
  { name: "FINNHUB_API_KEY", public: false },
  { name: "TWELVE_DATA_API_KEY", public: false },
  { name: "ALPHA_VANTAGE_API_KEY", public: false },
  { name: "COINGECKO_API_KEY", public: false },
  { name: "NEXT_PUBLIC_SUPABASE_URL", public: true },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", public: true },
  { name: "SUPABASE_SERVICE_ROLE_KEY", public: false }
];

const cache = new Map<string, { value: unknown; expiresAt: number; writtenAt: number; ttlMs: number }>();
const pending = new Map<string, Promise<unknown>>();

const nowIso = () => new Date().toISOString();
const numberOr = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};
const safeText = (value: unknown) => (typeof value === "string" ? value : "");
const normalizeSymbol = (symbol: string) => symbol.trim().toUpperCase();

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

const assetWithQuote = (asset: Asset, quote: ApiQuote, bars = asset.bars): Asset => ({
  ...asset,
  price: quote.price,
  change: quote.change,
  changePercent: quote.changePercent,
  open: quote.open || asset.open,
  previousClose: quote.previousClose || asset.previousClose,
  dayHigh: quote.dayHigh || asset.dayHigh,
  dayLow: quote.dayLow || asset.dayLow,
  volume: quote.volume || asset.volume,
  relativeVolume: asset.averageVolume ? Number(((quote.volume || asset.volume) / asset.averageVolume).toFixed(2)) : asset.relativeVolume,
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
});

const candlesForRange = (bars: Bar[], range: string) => {
  const upper = range.toUpperCase();
  const sizes: Record<string, number> = {
    "1D": 1,
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

const dedupeCandles = (bars: Bar[]) =>
  [...new Map(bars.filter((bar) => bar.time && Number.isFinite(bar.close)).map((bar) => [bar.time, bar])).values()].sort((a, b) => a.time.localeCompare(b.time));

const demoHistory = (symbol: string, range: string, interval: string, attempts: ProviderAttempt[] = []): HistoryEnvelope => {
  const asset = demoAssetForSymbol(symbol);
  if (!asset) throw new MarketDataError("Demo Fixture Provider", "not-found", "Symbol is not available in Demo Mode.");
  return {
    symbol: asset.symbol,
    range,
    interval,
    candles: candlesForRange(asset.bars, range),
    provider: "Demo Fixture Provider",
    dataStatus: "Demo",
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

const marketStatusNow = (): MarketMeta["marketStatus"] => {
  const date = new Date();
  const eastern = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const weekday = eastern.find((part) => part.type === "weekday")?.value;
  const hour = Number(eastern.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(eastern.find((part) => part.type === "minute")?.value ?? "0");
  const minutes = hour * 60 + minute;
  if (weekday === "Sat" || weekday === "Sun") return "Closed";
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
    supports: ["stock quotes", "stock candles", "symbol search", "company news"]
  },
  {
    name: "Twelve Data" as const,
    configured: Boolean(providerEnv.twelveData()),
    serverSideOnly: true,
    status: providerEnv.twelveData() ? "Configured server-side" : "Missing TWELVE_DATA_API_KEY",
    supports: ["stock quotes", "stock candles", "symbol search"]
  },
  {
    name: "Alpha Vantage" as const,
    configured: Boolean(providerEnv.alphaVantage()),
    serverSideOnly: true,
    status: providerEnv.alphaVantage() ? "Configured server-side" : "Missing ALPHA_VANTAGE_API_KEY",
    supports: ["stock quotes", "daily history", "symbol search", "news sentiment"]
  },
  {
    name: "CoinGecko" as const,
    configured: true,
    serverSideOnly: true,
    status: providerEnv.coinGecko() ? "Configured with API key" : "Using public CoinGecko endpoint; add COINGECKO_API_KEY for higher limits",
    supports: ["crypto quotes", "crypto market charts"]
  }
];

export const getRuntimeStatus = (): RuntimeStatus => {
  const providers = providerStatus();
  const stockConfigured = providers.some((provider) => provider.name !== "CoinGecko" && provider.configured);
  return {
    mode: stockConfigured ? "mixed" : "demo",
    demoMode: !stockConfigured,
    generatedAt: nowIso(),
    marketStatus: marketStatusNow(),
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
      "/api/crypto/history?id=bitcoin&range=1Y"
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
    dataStatus: "Live",
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
    dataStatus: "Live",
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

export const getStockQuote = async (symbolInput: string, options: { refresh?: boolean } = {}): Promise<QuoteEnvelope> => {
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
  const to = Math.floor(Date.now() / 1000);
  const days = range.toUpperCase() === "5Y" ? 1825 : range.toUpperCase() === "6M" ? 183 : range.toUpperCase() === "3M" ? 92 : 370;
  const from = to - days * 24 * 60 * 60;
  const payload = await fetchJson<{ s?: string; t?: number[]; o?: number[]; h?: number[]; l?: number[]; c?: number[]; v?: number[] }>(
    "Finnhub",
    `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${encodeURIComponent(key)}`,
    undefined,
    8000
  );
  if (payload.s !== "ok" || !payload.t?.length) throw new MarketDataError("Finnhub", "not-found", "Finnhub did not return candles for this symbol.");
  return dedupeCandles(
    payload.t.map((time, index) => ({
      time: new Date(time * 1000).toISOString().slice(0, 10),
      open: numberOr(payload.o?.[index]),
      high: numberOr(payload.h?.[index]),
      low: numberOr(payload.l?.[index]),
      close: numberOr(payload.c?.[index]),
      volume: Math.round(numberOr(payload.v?.[index]))
    }))
  );
};

const twelveHistory = async (symbol: string): Promise<Bar[]> => {
  const key = providerEnv.twelveData();
  if (!key) throw missingKey("Twelve Data", "TWELVE_DATA_API_KEY");
  const payload = await fetchJson<{ status?: string; message?: string; values?: Array<Record<string, string>> }>(
    "Twelve Data",
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=500&apikey=${encodeURIComponent(key)}`,
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

export const getStockHistory = async (symbolInput: string, range = "1Y", interval = "1D", options: { refresh?: boolean } = {}): Promise<HistoryEnvelope> => {
  const symbol = normalizeSymbol(symbolInput);
  const key = `stock-history:${symbol}:${range}:${interval}`;
  const cached = !options.refresh ? getCache<HistoryEnvelope>(key) : null;
  if (cached) return { ...cached.value, generatedAt: nowIso(), dataStatus: "Cached", provider: "Cached data", cache: cached.cache };

  return dedupe(key, async () => {
    const attempts: ProviderAttempt[] = [];
    for (const [provider, task] of [
      ["Finnhub", () => finnhubHistory(symbol, range)],
      ["Twelve Data", () => twelveHistory(symbol)],
      ["Alpha Vantage", () => alphaHistory(symbol)]
    ] as const) {
      try {
        const candles = candlesForRange(await task(), range);
        attempts.push({ provider, status: "success", message: "Provider returned normalized historical candles." });
        return setCache(
          key,
          {
            symbol,
            range,
            interval,
            candles,
            provider,
            dataStatus: provider === "Alpha Vantage" ? "Delayed" : "Live",
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
    return demoHistory(symbol, range, interval, attempts);
  });
};

const coinGeckoHeaders = () => {
  const key = providerEnv.coinGecko();
  return key ? { "x-cg-demo-api-key": key } : undefined;
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
        dataStatus: "Live",
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
  const key = `crypto-history:${id}:${range}`;
  const cached = !options.refresh ? getCache<HistoryEnvelope>(key) : null;
  if (cached) return { ...cached.value, generatedAt: nowIso(), dataStatus: "Cached", provider: "Cached data", cache: cached.cache };

  return dedupe(key, async () => {
    const attempts: ProviderAttempt[] = [];
    try {
      const days = range.toUpperCase() === "5Y" ? 1825 : range.toUpperCase() === "6M" ? 180 : range.toUpperCase() === "3M" ? 90 : 365;
      const payload = await fetchJson<{ prices?: Array<[number, number]>; total_volumes?: Array<[number, number]> }>(
        "CoinGecko",
        `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
        coinGeckoHeaders(),
        8000
      );
      if (!payload.prices?.length) throw new MarketDataError("CoinGecko", "not-found", "CoinGecko did not return historical prices for this coin id.");
      const candles = dedupeCandles(
        payload.prices.map(([time, price], index) => {
          const previous = payload.prices?.[Math.max(index - 1, 0)]?.[1] ?? price;
          const volume = payload.total_volumes?.[index]?.[1] ?? 0;
          const high = Math.max(price, previous);
          const low = Math.min(price, previous);
          return {
            time: new Date(time).toISOString().slice(0, 10),
            open: Number(previous.toFixed(2)),
            high: Number(high.toFixed(2)),
            low: Number(low.toFixed(2)),
            close: Number(price.toFixed(2)),
            volume: Math.round(volume)
          };
        })
      );
      attempts.push({ provider: "CoinGecko", status: "success", message: "CoinGecko returned normalized historical crypto candles." });
      return setCache(
        key,
        {
          symbol: mapped?.symbol ?? id.toUpperCase(),
          range,
          interval: "1D",
          candles,
          provider: "CoinGecko",
          dataStatus: "Live",
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
      return demoHistory(demo.symbol, range, "1D", attempts);
    }
  });
};

export const getSearchResults = async (queryInput: string): Promise<SearchEnvelope> => {
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

  try {
    const keyValue = providerEnv.finnhub();
    if (!keyValue) throw missingKey("Finnhub", "FINNHUB_API_KEY");
    const payload = await fetchJson<{ result?: Array<{ symbol?: string; description?: string; type?: string }> }>("Finnhub", `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${encodeURIComponent(keyValue)}`);
    payload.result?.slice(0, 10).forEach((item) => {
      if (item.symbol) results.set(item.symbol, { symbol: item.symbol, name: item.description || item.symbol, type: "stock", provider: "Finnhub", dataStatus: "Live" });
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
      if (item.symbol) results.set(item.symbol, { symbol: item.symbol, name: item.instrument_name || item.symbol, type: "stock", exchange: item.exchange, provider: "Twelve Data", dataStatus: "Live" });
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
          url: safeText(item.url) || undefined
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
          publishedAt: safeText(item.time_published) || nowIso(),
          tone: numberOr(item.overall_sentiment_score) > 0.1 ? "Positive" : numberOr(item.overall_sentiment_score) < -0.1 ? "Negative" : "Neutral",
          impactScore: Math.min(95, Math.max(35, Math.round(Math.abs(numberOr(item.overall_sentiment_score)) * 100))),
          relatedSymbols: [symbol],
          summary: safeText(item.summary) || "Provider news item.",
          url: safeText(item.url) || undefined
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

  const news = rows.length ? rows : fallback;
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
    const stockKeysConfigured = Boolean(providerEnv.finnhub() || providerEnv.twelveData() || providerEnv.alphaVantage());
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
