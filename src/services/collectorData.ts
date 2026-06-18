import { demoAssets, demoNews, providerHealth as demoProviderHealth } from "../data/fixtures";
import type { Asset, AssetType, Bar, DataStatus, ProviderHealth } from "../types";
import { getSupabaseAdmin, hasSupabaseServerConfig } from "./supabaseServer";
import type { ApiQuote, HistoryEnvelope, MarketProvider, MarketSnapshotEnvelope, RuntimeStatus, SearchEnvelope } from "./marketData";
import { getRuntimeStatus, marketStatusNow } from "./marketData";

type DbRow = Record<string, unknown>;

const nowIso = () => new Date().toISOString();
const numberOr = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const stringOr = (value: unknown, fallback = "") => (typeof value === "string" && value ? value : fallback);

const asDataStatus = (value: unknown): DataStatus => {
  const allowed: DataStatus[] = [
    "Live",
    "Real-time IEX",
    "Provider-supplied",
    "Near real-time",
    "Delayed",
    "Intraday snapshot",
    "End-of-day",
    "Cached",
    "Demo",
    "Market closed",
    "Stale",
    "Incomplete",
    "Temporarily unavailable",
    "Unavailable",
    "Provider error",
    "Rate limited"
  ];
  return allowed.includes(value as DataStatus) ? (value as DataStatus) : "Cached";
};

const heartbeatAgeSeconds = (lastHeartbeat: string | null) => {
  if (!lastHeartbeat) return null;
  const age = Math.floor((Date.now() - new Date(lastHeartbeat).getTime()) / 1000);
  return Number.isFinite(age) ? Math.max(0, age) : null;
};

const collectorStatusFromRow = (row: DbRow | null) => {
  if (!row) {
    return {
      status: "unavailable" as const,
      label: "Collector unavailable",
      message: "Collector tables are empty or Supabase server credentials are not configured.",
      lastHeartbeat: null,
      heartbeatAgeSeconds: null
    };
  }
  const explicit = stringOr(row.status, "offline") as NonNullable<RuntimeStatus["collector"]>["status"];
  const lastHeartbeat = row.last_heartbeat ? String(row.last_heartbeat) : null;
  const age = heartbeatAgeSeconds(lastHeartbeat);
  let status = explicit;
  if (!["manually_stopped", "paused", "paused_quiet_hours", "starting", "shutting_down", "crashed"].includes(explicit)) {
    if (age === null || age > 10 * 60) status = "offline";
    else if (age > 3 * 60) status = "delayed";
    else status = "online";
  }
  const labels: Record<string, string> = {
    online: "Collector Online",
    starting: "Collector Starting",
    paused: "Collector Paused",
    paused_quiet_hours: "Collector Paused",
    delayed: "Collector Delayed",
    offline: "Collector Offline",
    manually_stopped: "Collector manually stopped",
    crashed: "Collector crashed",
    shutting_down: "Collector shutting down",
    unavailable: "Collector unavailable"
  };
  const messages: Record<string, string> = {
    online: "Updating market data",
    starting: "Startup recovery is refreshing priority symbols first",
    paused: "Scanning is paused; lightweight heartbeat may continue",
    paused_quiet_hours: "Quiet hours are active; scans resume automatically afterward",
    delayed: "Some data may be stale",
    offline: "Showing cached market data",
    manually_stopped: "Showing last saved market data. Scanning will resume when the collector is started again.",
    crashed: "Showing cached market data from before the collector stopped unexpectedly",
    shutting_down: "The collector is closing connections and saving final status",
    unavailable: "Collector data has not been stored yet"
  };
  return { status, label: labels[status] ?? labels.unavailable, message: messages[status] ?? messages.unavailable, lastHeartbeat, heartbeatAgeSeconds: age };
};

const statusForQuote = (row: DbRow, collectorStatus: string): DataStatus => {
  const base = asDataStatus(row.data_status);
  const staleAfter = row.stale_after ? new Date(String(row.stale_after)).getTime() : 0;
  if (staleAfter && staleAfter < Date.now()) return "Stale";
  if (["offline", "manually_stopped", "crashed"].includes(collectorStatus) && ["Live", "Real-time IEX", "Provider-supplied", "Near real-time"].includes(base)) return "Cached";
  return base;
};

const assetType = (value: unknown): AssetType => {
  if (value === "etf" || value === "crypto" || value === "index" || value === "option") return value;
  return "stock";
};

const quoteToApiQuote = (quote: DbRow, asset: DbRow | null, collectorStatus: string): ApiQuote => {
  const price = numberOr(quote.price);
  const open = numberOr(quote.open, price);
  const previousClose = numberOr(quote.previous_close, open);
  return {
    symbol: stringOr(quote.symbol).toUpperCase(),
    name: stringOr(asset?.company_name, stringOr(quote.symbol).toUpperCase()),
    type: assetType(asset?.asset_type),
    price,
    change: numberOr(quote.change, price - previousClose),
    changePercent: numberOr(quote.change_percent, previousClose ? ((price - previousClose) / previousClose) * 100 : 0),
    open,
    previousClose,
    dayHigh: numberOr(quote.high, price),
    dayLow: numberOr(quote.low, price),
    volume: numberOr(quote.volume),
    timestamp: stringOr(quote.collected_at, nowIso()),
    provider: stringOr(quote.provider, "Supabase Collector") as MarketProvider,
    dataStatus: statusForQuote(quote, collectorStatus),
    marketStatus: marketStatusNow(),
    currency: "USD"
  };
};

const rowToAsset = (quote: DbRow, assetRow: DbRow | null, collectorStatus: string): Asset => {
  const apiQuote = quoteToApiQuote(quote, assetRow, collectorStatus);
  const fallback = demoAssets.find((asset) => asset.symbol === apiQuote.symbol) ?? demoAssets[0];
  const collectedAt = stringOr(quote.collected_at, nowIso());
  const status = apiQuote.dataStatus;
  const staleReason =
    status === "Stale"
      ? "The local collector has not refreshed this symbol before its stale-after time."
      : status === "Cached"
        ? "The collector is offline, stopped, or delayed; this is the last saved value."
        : undefined;
  return {
    ...fallback,
    symbol: apiQuote.symbol,
    name: apiQuote.name,
    type: apiQuote.type,
    exchange: stringOr(assetRow?.exchange, fallback.exchange),
    sector: stringOr(assetRow?.sector, fallback.sector),
    price: apiQuote.price,
    change: apiQuote.change,
    changePercent: apiQuote.changePercent,
    open: apiQuote.open,
    previousClose: apiQuote.previousClose,
    dayHigh: apiQuote.dayHigh,
    dayLow: apiQuote.dayLow,
    volume: apiQuote.volume,
    averageVolume: numberOr(quote.average_volume, fallback.averageVolume),
    relativeVolume: numberOr(quote.relative_volume, fallback.relativeVolume),
    confidence: Math.max(0, Math.min(100, Math.round(numberOr(quote.scanner_score, fallback.confidence)))),
    meta: {
      provider: `${apiQuote.provider}${quote.feed ? ` ${quote.feed}` : ""}`,
      providerTimestamp: stringOr(quote.provider_timestamp, collectedAt),
      ingestionTimestamp: collectedAt,
      lastUpdated: collectedAt,
      timezone: "America/New_York",
      marketStatus: apiQuote.marketStatus,
      dataStatus: status,
      staleReason
    },
    bars: [
      {
        time: collectedAt,
        open: apiQuote.open,
        high: apiQuote.dayHigh,
        low: apiQuote.dayLow,
        close: apiQuote.price,
        volume: apiQuote.volume
      }
    ]
  };
};

const getLatestCollectorStatusRow = async () => {
  const supabase = getSupabaseAdmin();
  if (!supabase || !hasSupabaseServerConfig()) return null;
  const { data, error } = await supabase.from("collector_status").select("*").order("last_heartbeat", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  if (error) return null;
  return (data as DbRow | null) ?? null;
};

const countRows = async (table: string) => {
  const supabase = getSupabaseAdmin();
  if (!supabase || !hasSupabaseServerConfig()) return 0;
  const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
};

export const getRuntimeStatusWithCollector = async (): Promise<RuntimeStatus> => {
  const base = getRuntimeStatus();
  const row = await getLatestCollectorStatusRow();
  const collector = collectorStatusFromRow(row);
  const [assetsStored, latestQuotesStored] = await Promise.all([countRows("market_assets"), countRows("latest_quotes")]);
  const liveSymbols = Array.isArray(row?.live_symbols) ? (row?.live_symbols as unknown[]) : [];
  const lastSuccessfulUpdate = stringOr(row?.last_priority_scan || row?.last_broad_scan || row?.last_heartbeat, null as never) || null;
  const collectorInfo: RuntimeStatus["collector"] = {
    ...collector,
    lastSuccessfulUpdate,
    lastBroadScan: row?.last_broad_scan ? String(row.last_broad_scan) : null,
    lastPriorityScan: row?.last_priority_scan ? String(row.last_priority_scan) : null,
    websocketStatus: row?.websocket_status ? String(row.websocket_status) : null,
    liveSymbolCount: liveSymbols.length,
    assetsStored,
    latestQuotesStored,
    assetsScanned: numberOr(row?.assets_scanned),
    recordsWritten: numberOr(row?.records_written),
    currentJob: row?.current_job ? String(row.current_job) : null,
    lastError: row?.last_error ? String(row.last_error) : null
  };
  const hasCollectorData = latestQuotesStored > 0;
  return {
    ...base,
    mode: hasCollectorData ? (collector.status === "online" ? "mixed" : "cached") : base.mode,
    applicationMode: hasCollectorData ? (collector.status === "online" ? "Mixed" : "Cached") : base.applicationMode,
    demoMode: hasCollectorData ? false : base.demoMode,
    collector: collectorInfo,
    marketCoverage: {
      marketUniverse: assetsStored,
      broadScanner: `${assetsStored ? Math.min(assetsStored, 500) : 0} stored symbols checked in rotating batches while collector is online`,
      priorityScanner: "Up to 100 high-priority symbols every 5 minutes while collector is online",
      liveScanner: `Up to ${collectorInfo.liveSymbolCount || 30} symbols streamed through IEX when configured`,
      lastCompleteBroadScan: collectorInfo.lastBroadScan,
      source: hasCollectorData ? "Supabase collector tables" : "Demo/provider fallback"
    }
  };
};

export const getStoredQuote = async (symbol: string) => {
  const supabase = getSupabaseAdmin();
  if (!supabase || !hasSupabaseServerConfig()) return null;
  const normalized = symbol.toUpperCase();
  const statusRow = await getLatestCollectorStatusRow();
  const collector = collectorStatusFromRow(statusRow);
  const [{ data: quote, error: quoteError }, { data: asset, error: assetError }] = await Promise.all([
    supabase.from("latest_quotes").select("*").eq("symbol", normalized).maybeSingle(),
    supabase.from("market_assets").select("*").eq("symbol", normalized).maybeSingle()
  ]);
  if (quoteError || assetError || !quote) return null;
  return {
    quote: quoteToApiQuote(quote as DbRow, (asset as DbRow | null) ?? null, collector.status),
    generatedAt: nowIso(),
    cache: { hit: true, stale: collector.status !== "online", ttlSeconds: 30 },
    attempts: [{ provider: "Supabase Collector", status: "success", message: "Read current quote from latest_quotes." }]
  };
};

export const getStoredHistory = async (symbol: string, range: string, interval: string): Promise<HistoryEnvelope | null> => {
  const supabase = getSupabaseAdmin();
  if (!supabase || !hasSupabaseServerConfig()) return null;
  const normalized = symbol.toUpperCase();
  const useDaily = interval === "1D" || interval === "1W" || interval === "1M";
  const limit = range === "5Y" ? 1300 : range === "1Y" ? 370 : range === "6M" ? 190 : range === "3M" ? 100 : range === "1M" ? 35 : 10;
  const query = useDaily
    ? supabase.from("daily_bars").select("*").eq("symbol", normalized).order("trading_date", { ascending: false }).limit(limit)
    : supabase.from("intraday_bars").select("*").eq("symbol", normalized).eq("interval", interval).order("bar_timestamp", { ascending: false }).limit(limit);
  const { data, error } = await query;
  if (error || !data?.length) return null;
  const rows = [...(data as DbRow[])].reverse();
  const candles: Bar[] = rows.map((row) => ({
    time: String(useDaily ? row.trading_date : row.bar_timestamp),
    open: numberOr(row.open),
    high: numberOr(row.high),
    low: numberOr(row.low),
    close: numberOr(row.close),
    volume: numberOr(row.volume)
  }));
  return {
    symbol: normalized,
    range,
    interval,
    candles,
    provider: stringOr(rows[rows.length - 1]?.provider, "Supabase Collector") as MarketProvider,
    dataStatus: useDaily ? "End-of-day" : "Intraday snapshot",
    dataShape: "ohlc",
    actualRange: { start: candles[0]?.time ?? null, end: candles[candles.length - 1]?.time ?? null, points: candles.length },
    note: "Historical bars read from Supabase collector storage.",
    generatedAt: nowIso(),
    cache: { hit: true, stale: false, ttlSeconds: 300 },
    attempts: [{ provider: "Supabase Collector", status: "success", message: "Read stored bars from collector tables." }]
  };
};

export const getStoredSearchResults = async (query: string): Promise<SearchEnvelope | null> => {
  const supabase = getSupabaseAdmin();
  if (!supabase || !hasSupabaseServerConfig() || !query.trim()) return null;
  const safe = query.trim().replace(/[%_,]/g, "");
  const { data, error } = await supabase
    .from("market_assets")
    .select("symbol,company_name,asset_type,exchange,provider")
    .or(`symbol.ilike.%${safe}%,company_name.ilike.%${safe}%`)
    .limit(20);
  if (error || !data?.length) return null;
  return {
    query,
    results: (data as DbRow[]).map((row) => ({
      symbol: stringOr(row.symbol),
      name: stringOr(row.company_name, stringOr(row.symbol)),
      type: assetType(row.asset_type),
      exchange: row.exchange ? String(row.exchange) : undefined,
      provider: "Supabase Collector",
      dataStatus: "Cached"
    })),
    generatedAt: nowIso(),
    cache: { hit: true, stale: false, ttlSeconds: 3600 },
    attempts: [{ provider: "Supabase Collector", status: "success", message: "Searched stored market_assets." }]
  };
};

export const getStoredMarketSnapshot = async (): Promise<MarketSnapshotEnvelope | null> => {
  const supabase = getSupabaseAdmin();
  if (!supabase || !hasSupabaseServerConfig()) return null;
  const status = await getRuntimeStatusWithCollector();
  const { data: quotes, error } = await supabase
    .from("latest_quotes")
    .select("*")
    .order("scanner_score", { ascending: false, nullsFirst: false })
    .order("collected_at", { ascending: false })
    .limit(100);
  if (error || !quotes?.length) return null;
  const symbols = (quotes as DbRow[]).map((row) => String(row.symbol));
  const { data: assetRows } = await supabase.from("market_assets").select("*").in("symbol", symbols);
  const assetsBySymbol = new Map((assetRows as DbRow[] | null | undefined)?.map((row) => [String(row.symbol), row]) ?? []);
  const assets = (quotes as DbRow[]).map((quote) => rowToAsset(quote, assetsBySymbol.get(String(quote.symbol)) ?? null, status.collector?.status ?? "offline"));
  const providerHealth = await getStoredProviderHealth();
  return {
    assets,
    news: demoNews.map((item) => ({ ...item, dataStatus: status.mode === "cached" ? "Cached" : item.dataStatus ?? "Demo" })),
    status,
    providerHealth: providerHealth.length ? providerHealth : demoProviderHealth,
    generatedAt: nowIso(),
    cache: { hit: true, stale: status.collector?.status !== "online", ttlSeconds: 60 }
  };
};

export const getStoredProviderHealth = async (): Promise<ProviderHealth[]> => {
  const supabase = getSupabaseAdmin();
  if (!supabase || !hasSupabaseServerConfig()) return [];
  const { data, error } = await supabase.from("provider_health").select("*").limit(50);
  if (error || !data) return [];
  return (data as DbRow[]).map((row) => ({
    provider: `${stringOr(row.provider)} ${stringOr(row.capability)}`.trim(),
    marketData: row.status === "available" ? "Healthy" : row.status === "missing_key" ? "Missing" : row.status === "rate_limited" ? "Rate limited" : "Unavailable",
    newsData: "Disabled",
    lastRun: stringOr(row.last_success || row.last_failure, nowIso()),
    notes: stringOr(row.last_error, `Collector capability ${stringOr(row.capability)} is ${stringOr(row.status, "unknown")}.`)
  }));
};
