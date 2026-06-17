"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Download,
  Gauge,
  Home,
  LineChart,
  Lock,
  Menu,
  Moon,
  Newspaper,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  TrendingDown,
  TrendingUp,
  User,
  X,
  Zap
} from "lucide-react";
import type React from "react";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { MarketChart } from "./components/MarketChart";
import { appConfig } from "./config";
import { demoAssets, demoNews, providerHealth } from "./data/fixtures";
import { glossaryTerms, searchGlossary } from "./data/glossary";
import { calculateMarketMood, calculateScenario } from "./lib/calculations";
import { compactNumber, currency, formatDateTime, percent } from "./lib/format";
import { explainStatus, statusSeverity } from "./lib/dataStatus";
import { parseRoutePath, pathForAsset, pathForRoute, type RouteId } from "./lib/routing";
import { hasSupabaseConfig } from "./supabaseClient";
import type { Asset, AssetType, NewsItem, ProviderHealth, SignalLabel } from "./types";
import type { ApiQuote, HistoryEnvelope, RuntimeStatus, SearchResult } from "./services/marketData";

type ExperienceMode = "beginner" | "intermediate" | "advanced";
type SortKey = "symbol" | "price" | "changePercent" | "volume" | "risk" | "confidence";
type MarketPayload = {
  assets: Asset[];
  news: NewsItem[];
  status: RuntimeStatus;
  providerHealth: ProviderHealth[];
  generatedAt: string;
  cache: { hit: boolean; stale: boolean; ttlSeconds: number };
};

type Watchlist = { id: string; name: string; symbols: string[]; notes: string };
type AlertRule = { id: string; symbol: string; type: string; value: string; enabled: boolean; demo: boolean; lastChecked?: string; triggerCount?: number };

const defaultWatchlists: Watchlist[] = [
  { id: "default", name: "Default Research", symbols: ["MSFT", "SPY", "BTC-USD"], notes: "Signed-out local watchlist." },
  { id: "risk", name: "High Risk Watch", symbols: ["TSLA", "SOL-USD"], notes: "Keep position sizing research conservative." }
];

const defaultAlertRules: AlertRule[] = [
  { id: "price-msft", symbol: "MSFT", type: "Price above", value: "490", enabled: true, demo: true, triggerCount: 0 },
  { id: "risk-tsla", symbol: "TSLA", type: "Provider outage", value: "any", enabled: true, demo: true, triggerCount: 0 }
];

interface NavItem {
  id: RouteId;
  label: string;
  icon: typeof Home;
  admin?: boolean;
}

const navGroups: Array<{ title: string; items: NavItem[] }> = [
  { title: "Home", items: [{ id: "dashboard", label: "Dashboard", icon: Gauge }] },
  {
    title: "Markets",
    items: [
      { id: "stocks", label: "Stocks", icon: LineChart },
      { id: "crypto", label: "Crypto", icon: Activity },
      { id: "etfs", label: "ETFs", icon: BarChart3 },
      { id: "indexes", label: "Indexes", icon: BarChart3 }
    ]
  },
  {
    title: "Research",
    items: [
      { id: "news", label: "Market News", icon: Newspaper },
      { id: "screener", label: "Screener", icon: Search },
      { id: "predictions", label: "Predictions", icon: Target },
      { id: "compare", label: "Compare Assets", icon: BarChart3 },
      { id: "ideas", label: "Research Ideas", icon: Sparkles }
    ]
  },
  {
    title: "Portfolio Tools",
    items: [
      { id: "watchlists", label: "Watchlists", icon: Bell },
      { id: "alerts", label: "Alerts", icon: Zap }
    ]
  },
  {
    title: "Education",
    items: [
      { id: "learn", label: "Learn", icon: BookOpen },
      { id: "definitions", label: "Keyword Definitions", icon: BookOpen }
    ]
  },
  {
    title: "Account",
    items: [
      { id: "profile", label: "Profile", icon: User },
      { id: "settings", label: "Settings", icon: Settings }
    ]
  },
  { title: "System", items: [{ id: "status", label: "Data Status", icon: ShieldCheck }] },
  {
    title: "Admin",
    items: [
      { id: "admin", label: "Admin Dashboard", icon: Lock, admin: true },
      { id: "backend", label: "Backend Jobs", icon: Activity, admin: true },
      { id: "quality", label: "Data Quality", icon: CheckCircle2, admin: true },
      { id: "api-usage", label: "API Usage", icon: BarChart3, admin: true },
      { id: "audit", label: "Audit Logs", icon: ShieldCheck, admin: true }
    ]
  }
];

const signalClass = (signal: SignalLabel) => {
  if (signal === "Watch") return "positive";
  if (signal === "Avoid") return "negative";
  return "warning";
};

const routeAssetType: Partial<Record<RouteId, AssetType>> = {
  stocks: "stock",
  crypto: "crypto",
  etfs: "etf",
  indexes: "index"
};

const cryptoApiId = (symbol: string) => {
  const normalized = symbol.toUpperCase().replace("-USD", "");
  if (normalized === "BTC" || normalized === "BTCUSD") return "bitcoin";
  if (normalized === "ETH" || normalized === "ETHUSD") return "ethereum";
  if (normalized === "SOL" || normalized === "SOLUSD") return "solana";
  return symbol.toLowerCase();
};

const quoteToAsset = (quote: ApiQuote, existing?: Asset): Asset => {
  const template = existing ?? demoAssets.find((asset) => asset.type === quote.type) ?? demoAssets[0];
  return {
    ...template,
    symbol: quote.symbol,
    name: quote.name,
    type: quote.type,
    price: quote.price,
    change: quote.change,
    changePercent: quote.changePercent,
    open: quote.open,
    previousClose: quote.previousClose,
    dayHigh: quote.dayHigh,
    dayLow: quote.dayLow,
    volume: quote.volume,
    exchange: existing?.exchange ?? (quote.type === "crypto" ? "Crypto" : "Provider"),
    sector: existing?.sector ?? (quote.type === "crypto" ? "Crypto" : "Provider result"),
    bars: existing?.bars ?? template.bars,
    meta: {
      ...template.meta,
      provider: quote.provider,
      providerTimestamp: quote.timestamp,
      ingestionTimestamp: new Date().toISOString(),
      lastUpdated: quote.timestamp,
      marketStatus: quote.marketStatus,
      dataStatus: quote.dataStatus
    },
    explanation: existing?.explanation ?? "Provider search result. Non-price research metrics remain demo-derived until provider enrichment is configured."
  };
};

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function ComingSoon({ label }: { label: string }) {
  return <Badge tone="warning">{label} Coming Soon</Badge>;
}

function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

function Meter({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="meter">
      <div className="row-between">
        <span>{label}</span>
        <strong>{value}/100</strong>
      </div>
      <div className={danger ? "meter-track danger" : "meter-track"}>
        <div style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function PageTitle({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div className="page-title">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{copy}</p>
    </div>
  );
}

function DataPill({ asset }: { asset: Asset }) {
  return <Badge tone={statusSeverity(asset.meta.dataStatus)}>{asset.meta.dataStatus}</Badge>;
}

function AssetRow({
  asset,
  onOpen,
  onWatch,
  compact = false
}: {
  asset: Asset;
  onOpen: (symbol: string) => void;
  onWatch: (symbol: string) => void;
  compact?: boolean;
}) {
  return (
    <article className={compact ? "asset-row asset-row-compact" : "asset-row"}>
      <button className="asset-identity" type="button" onClick={() => onOpen(asset.symbol)}>
        <span className="asset-logo">{asset.symbol.slice(0, 2).replace("^", "I")}</span>
        <span>
          <strong>{asset.symbol}</strong>
          <small>{asset.name}</small>
        </span>
      </button>
      <span>{asset.type.toUpperCase()}</span>
      <span className="number">{currency(asset.price)}</span>
      <span className={asset.changePercent >= 0 ? "positive" : "negative"}>{percent(asset.changePercent)}</span>
      <Badge tone={signalClass(asset.signal)}>{asset.signal}</Badge>
      <span>Risk {asset.risk}</span>
      <DataPill asset={asset} />
      <button className="small-button" type="button" onClick={() => onWatch(asset.symbol)}>
        Watch
      </button>
    </article>
  );
}

export default function App({ initialPath = "/" }: { initialPath?: string }) {
  const initialRoute = parseRoutePath(initialPath);
  const [route, setRoute] = useState<RouteId>(initialRoute.route);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [experience, setExperience] = useState<ExperienceMode>("beginner");
  const adminMode = false;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState(initialRoute.selectedSymbol ?? "MSFT");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [toast, setToast] = useState("Demo Mode active. Add provider keys in Vercel to enable live data.");
  const [lastRefresh, setLastRefresh] = useState("2026-06-15T14:36:03-04:00");
  const [refreshing, setRefreshing] = useState(false);
  const [marketAssets, setMarketAssets] = useState<Asset[]>(demoAssets);
  const [marketNews, setMarketNews] = useState<NewsItem[]>(demoNews);
  const [providerRows, setProviderRows] = useState<ProviderHealth[]>(providerHealth);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);
  const [watchlists, setWatchlists] = useState<Watchlist[]>(defaultWatchlists);
  const [activeWatchlist, setActiveWatchlist] = useState("default");
  const [watchlistSort, setWatchlistSort] = useState<SortKey>("symbol");
  const [alertRules, setAlertRules] = useState<AlertRule[]>(defaultAlertRules);
  const [screenerType, setScreenerType] = useState<"all" | AssetType>("all");
  const [screenerSearch, setScreenerSearch] = useState("");
  const [screenerSort, setScreenerSort] = useState<SortKey>("confidence");
  const [screenerPage, setScreenerPage] = useState(1);
  const [scenarioAmount, setScenarioAmount] = useState(1000);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const refreshReadyAt = useRef(0);

  const selectedAsset = marketAssets.find((asset) => asset.symbol === selectedSymbol) ?? marketAssets[0] ?? demoAssets[0];
  const selectedRouteMissing =
    ["stocks", "crypto", "etfs", "indexes"].includes(route) && selectedSymbol && !marketAssets.some((asset) => asset.symbol === selectedSymbol);
  const mood = useMemo(() => calculateMarketMood(marketAssets), [marketAssets]);
  const currentWatchlist = watchlists.find((list) => list.id === activeWatchlist) ?? watchlists[0];
  const marketScope = routeAssetType[route];
  const scopedAssets = marketScope ? marketAssets.filter((asset) => asset.type === marketScope) : marketAssets;
  const localSearchMatches = useMemo(
    () =>
      fuzzySearchAssets(query, marketAssets)
        .slice(0, 7)
        .map<SearchResult>((asset) => ({
          symbol: asset.symbol,
          name: asset.name,
          type: asset.type,
          exchange: asset.exchange,
          provider: "Demo Fixture Provider",
          dataStatus: asset.meta.dataStatus
        })),
    [query, marketAssets]
  );
  const searchMatches = useMemo(() => {
    const rows = new Map<string, SearchResult>();
    searchResults.forEach((result) => rows.set(result.symbol, result));
    localSearchMatches.forEach((result) => {
      if (!rows.has(result.symbol)) rows.set(result.symbol, result);
    });
    return [...rows.values()].slice(0, 10);
  }, [localSearchMatches, searchResults]);
  const glossaryMatches = useMemo(() => searchGlossary(query).slice(0, 18), [query]);
  const scenario = calculateScenario({
    amount: scenarioAmount,
    possibleGainPercent: selectedAsset.prediction.possibleGainPercent,
    possibleLossPercent: selectedAsset.prediction.possibleLossPercent
  });

  useEffect(() => {
    const saved = localStorage.getItem("msd-recent-searches");
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved) as string[]);
      } catch {
        localStorage.removeItem("msd-recent-searches");
      }
    }
    const savedWatchlists = localStorage.getItem("msd-watchlists");
    if (savedWatchlists) {
      try {
        const parsed = JSON.parse(savedWatchlists) as Watchlist[];
        if (parsed.length) setWatchlists(parsed);
      } catch {
        localStorage.removeItem("msd-watchlists");
      }
    }
    const savedActiveWatchlist = localStorage.getItem("msd-active-watchlist");
    if (savedActiveWatchlist) setActiveWatchlist(savedActiveWatchlist);
    const savedAlerts = localStorage.getItem("msd-alert-rules");
    if (savedAlerts) {
      try {
        const parsed = JSON.parse(savedAlerts) as AlertRule[];
        if (parsed.length) setAlertRules(parsed);
      } catch {
        localStorage.removeItem("msd-alert-rules");
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("msd-recent-searches", JSON.stringify(recentSearches.slice(0, 6)));
  }, [recentSearches]);

  useEffect(() => {
    localStorage.setItem("msd-watchlists", JSON.stringify(watchlists));
  }, [watchlists]);

  useEffect(() => {
    localStorage.setItem("msd-active-watchlist", activeWatchlist);
  }, [activeWatchlist]);

  useEffect(() => {
    localStorage.setItem("msd-alert-rules", JSON.stringify(alertRules));
  }, [alertRules]);

  useEffect(() => {
    setActiveSuggestion(0);
  }, [query]);

  useEffect(() => {
    setActiveSuggestion((value) => Math.min(value, Math.max(searchMatches.length - 1, 0)));
  }, [searchMatches.length]);

  useEffect(() => {
    const onPopState = () => {
      const state = parseRoutePath(window.location.pathname);
      if (state.invalid) return;
      setRoute(state.route);
      if (state.selectedSymbol) setSelectedSymbol(state.selectedSymbol);
      setMobileMenuOpen(false);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError("");
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("Search API failed");
          return response.json() as Promise<{ results: SearchResult[] }>;
        })
        .then((payload) => {
          setSearchResults(payload.results ?? []);
          setSearchError("");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setSearchResults([]);
          setSearchError("Provider search unavailable. Showing local fallback results.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchLoading(false);
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const closeSearch = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", closeSearch);
    return () => document.removeEventListener("mousedown", closeSearch);
  }, []);

  const applyMarketPayload = (payload: MarketPayload) => {
    setMarketAssets(payload.assets.length ? payload.assets : demoAssets);
    setMarketNews(payload.news.length ? payload.news : demoNews);
    setProviderRows(payload.providerHealth.length ? payload.providerHealth : providerHealth);
    setRuntimeStatus(payload.status);
    setLastRefresh(payload.generatedAt);
    const liveCount = payload.assets.filter((asset) => asset.meta.dataStatus === "Live" || asset.meta.dataStatus === "Delayed").length;
    const sourceLabel = payload.cache.hit ? "Cached" : liveCount ? "Provider-backed" : "Demo fallback";
    setToast(`${sourceLabel} market data loaded. ${liveCount}/${payload.assets.length} assets have provider-backed labels.`);
  };

  const loadAssetHistory = async (asset: Asset, refresh = false) => {
    try {
      const endpoint =
        asset.type === "crypto"
          ? `/api/crypto/history?id=${encodeURIComponent(cryptoApiId(asset.symbol))}&range=1Y${refresh ? "&refresh=true" : ""}`
          : `/api/history?symbol=${encodeURIComponent(asset.symbol)}&range=1Y&interval=1D${refresh ? "&refresh=true" : ""}`;
      const response = await fetch(endpoint);
      if (!response.ok) return;
      const history = (await response.json()) as HistoryEnvelope;
      if (!history.candles?.length) return;
      setMarketAssets((assets) =>
        assets.map((item) =>
          item.symbol === asset.symbol
            ? {
                ...item,
                bars: history.candles,
                meta: {
                  ...item.meta,
                  provider: history.provider,
                  dataStatus: history.dataStatus,
                  lastUpdated: history.generatedAt,
                  providerTimestamp: history.generatedAt
                }
              }
            : item
        )
      );
    } catch {
      setToast("Historical chart refresh failed. Existing cached or demo candles remain visible.");
    }
  };

  const loadMarkets = async (refresh = false) => {
    const response = await fetch(`/api/markets${refresh ? "?refresh=true" : ""}`);
    if (!response.ok) throw new Error("Market API failed");
    const payload = (await response.json()) as MarketPayload;
    applyMarketPayload(payload);
    const current = payload.assets.find((asset) => asset.symbol === selectedSymbol) ?? payload.assets[0];
    if (current) void loadAssetHistory(current, refresh);
  };

  useEffect(() => {
    void loadMarkets(false).catch(() => {
      setToast("Market API unavailable. Demo fixtures remain visible.");
    });
  }, []);

  const navigate = (id: RouteId, symbol?: string, type?: AssetType) => {
    setRoute(id);
    if (symbol) setSelectedSymbol(symbol);
    setMobileMenuOpen(false);
    const nextPath = pathForRoute(id, symbol, type);
    if (typeof window !== "undefined" && window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
  };

  const openRoute = (id: RouteId) => {
    navigate(id);
  };

  const openAsset = (symbol: string, replaceHistory = false) => {
    const asset = marketAssets.find((item) => item.symbol === symbol);
    if (!asset) {
      setToast("Asset not found. Use search suggestions or return to search.");
      return;
    }
    setSelectedSymbol(symbol);
    const nextRoute = asset.type === "stock" ? "stocks" : asset.type === "crypto" ? "crypto" : asset.type === "etf" ? "etfs" : "indexes";
    setRoute(nextRoute);
    setQuery("");
    setSearchOpen(false);
    setRecentSearches((current) => [symbol, ...current.filter((item) => item !== symbol)].slice(0, 6));
    setToast(`${symbol} opened with stored ${asset.meta.dataStatus} data.`);
    const nextPath = pathForAsset(asset.type, symbol);
    if (typeof window !== "undefined" && window.location.pathname !== nextPath) {
      if (replaceHistory) window.history.replaceState({}, "", nextPath);
      else window.history.pushState({}, "", nextPath);
    }
    void loadAssetHistory(asset);
  };

  const openSearchResult = async (result: SearchResult) => {
    const known = marketAssets.find((asset) => asset.symbol === result.symbol);
    const endpoint =
      result.type === "crypto"
        ? `/api/crypto/quote?id=${encodeURIComponent(cryptoApiId(result.symbol))}`
        : `/api/quote?symbol=${encodeURIComponent(result.symbol)}`;
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        setToast(`Asset not found: ${result.symbol}. The app did not substitute another ticker.`);
        return;
      }
      const payload = (await response.json()) as { quote: ApiQuote };
      const enriched = quoteToAsset(payload.quote, known);
      setMarketAssets((assets) => {
        const exists = assets.some((asset) => asset.symbol === enriched.symbol);
        return exists ? assets.map((asset) => (asset.symbol === enriched.symbol ? { ...asset, ...enriched } : asset)) : [enriched, ...assets];
      });
      setSelectedSymbol(enriched.symbol);
      setRoute(enriched.type === "crypto" ? "crypto" : enriched.type === "etf" ? "etfs" : enriched.type === "index" ? "indexes" : "stocks");
      setQuery("");
      setSearchOpen(false);
      setRecentSearches((current) => [enriched.symbol, ...current.filter((item) => item !== enriched.symbol)].slice(0, 6));
      const nextPath = pathForAsset(enriched.type, enriched.symbol);
      if (typeof window !== "undefined" && window.location.pathname !== nextPath) window.history.pushState({}, "", nextPath);
      setToast(`${enriched.symbol} opened from provider search. Quote loaded before the page changed.`);
      void loadAssetHistory(enriched);
    } catch {
      setToast("Search selection failed safely. No provider error details were exposed.");
    }
  };

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (searchMatches[0]) void openSearchResult(searchMatches[0]);
    else setToast("Asset not found. The app did not substitute another ticker.");
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion((value) => Math.min(value + 1, Math.max(searchMatches.length - 1, 0)));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((value) => Math.max(value - 1, 0));
    }
    if (event.key === "Enter" && searchOpen && searchMatches[activeSuggestion]) {
      event.preventDefault();
      void openSearchResult(searchMatches[activeSuggestion]);
    }
    if (event.key === "Escape") setSearchOpen(false);
  };

  const refreshData = async () => {
    const now = Date.now();
    if (refreshing || now < refreshReadyAt.current) {
      setToast("Manual refresh is cooling down to avoid duplicate provider requests.");
      return;
    }
    refreshReadyAt.current = now + 20_000;
    setRefreshing(true);
    try {
      const response = await fetch("/api/refresh", { method: "POST" });
      if (!response.ok) throw new Error("Refresh failed");
      const payload = (await response.json()) as { status: string; lastUpdated: string; message: string; market: MarketPayload };
      if (payload.market) applyMarketPayload(payload.market);
      setLastRefresh(payload.lastUpdated);
      setToast(payload.message);
    } catch {
      setToast("Refresh failed. Demo data remains available and no private errors were exposed.");
    } finally {
      setRefreshing(false);
    }
  };

  const toggleWatchlistAsset = (symbol: string) => {
    setWatchlists((lists) =>
      lists.map((list) =>
        list.id === activeWatchlist
          ? {
              ...list,
              symbols: list.symbols.includes(symbol) ? list.symbols.filter((item) => item !== symbol) : [...list.symbols, symbol]
            }
          : list
      )
    );
    setToast(`${symbol} watchlist state updated locally. Signed-in storage activates after Supabase is configured.`);
  };

  const createWatchlist = () => {
    const id = `watch-${Date.now()}`;
    setWatchlists((lists) => [...lists, { id, name: `Research List ${lists.length + 1}`, symbols: [], notes: "" }]);
    setActiveWatchlist(id);
  };

  const exportCsv = (assets: Asset[], fileName: string) => {
    const header = ["symbol", "name", "type", "price", "changePercent", "volume", "risk", "confidence", "signal"];
    const rows = assets.map((asset) =>
      [asset.symbol, asset.name, asset.type, asset.price, asset.changePercent, asset.volume, asset.risk, asset.confidence, asset.signal]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const nav = (
    <Sidebar
      route={route}
      adminMode={adminMode}
      runtimeStatus={runtimeStatus}
      onRoute={openRoute}
      onClose={() => setMobileMenuOpen(false)}
    />
  );

  return (
    <div className={`app ${theme}`}>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <aside className="sidebar desktop-sidebar">{nav}</aside>
      {mobileMenuOpen ? (
        <div className="mobile-menu-layer" role="presentation" onClick={() => setMobileMenuOpen(false)}>
          <aside className="mobile-drawer" aria-label="Mobile menu" onClick={(event) => event.stopPropagation()}>
            {nav}
          </aside>
        </div>
      ) : null}

      <main className="main" id="content">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" type="button" aria-label="Open menu" onClick={() => setMobileMenuOpen(true)}>
            <Menu size={18} />
          </button>
          <GlobalSearch
            query={query}
            searchOpen={searchOpen}
            matches={searchMatches}
            recentSearches={recentSearches}
            activeSuggestion={activeSuggestion}
            loading={searchLoading}
            error={searchError}
            searchRef={searchRef}
            onQuery={setQuery}
            onOpen={setSearchOpen}
            onSubmit={handleSearchSubmit}
            onKeyDown={handleSearchKeyDown}
            onAsset={(result) => void openSearchResult(result)}
          />
          <div className="top-actions">
            <button className="ghost-button" type="button" onClick={refreshData} disabled={refreshing}>
              <RefreshCw size={16} /> {refreshing ? "Refreshing" : "Refresh"}
            </button>
            <select className="select-control" value={experience} onChange={(event) => setExperience(event.target.value as ExperienceMode)} aria-label="Experience mode">
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            <button className="icon-button" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <TickerTape assets={marketAssets} onOpen={openAsset} />
        <SafetyStrip />

        {route === "dashboard" ? (
          <Dashboard
            mood={mood}
            lastRefresh={lastRefresh}
            refreshing={refreshing}
            onRefresh={refreshData}
            onOpen={openAsset}
            onWatch={toggleWatchlistAsset}
            watchlist={currentWatchlist}
            assets={marketAssets}
            news={marketNews}
            runtimeStatus={runtimeStatus}
          />
        ) : null}
        {selectedRouteMissing ? <AssetNotFoundPage symbol={selectedSymbol} onRoute={openRoute} /> : null}
        {["stocks", "crypto", "etfs", "indexes"].includes(route) && !selectedRouteMissing ? (
          <AssetDetail asset={selectedAsset} assets={scopedAssets} news={marketNews} experience={experience} onOpen={openAsset} onWatch={toggleWatchlistAsset} />
        ) : null}
        {route === "news" ? <NewsDesk news={marketNews} onOpen={openAsset} /> : null}
        {route === "screener" ? (
          <Screener
            type={screenerType}
            search={screenerSearch}
            sort={screenerSort}
            page={screenerPage}
            onType={setScreenerType}
            onSearch={(value) => {
              setScreenerSearch(value);
              setScreenerPage(1);
            }}
            onSort={setScreenerSort}
            onPage={setScreenerPage}
            onOpen={openAsset}
            onWatch={toggleWatchlistAsset}
            onExport={exportCsv}
            assets={marketAssets}
          />
        ) : null}
        {route === "predictions" ? <PredictionsPage selectedAsset={selectedAsset} assets={marketAssets} scenarioAmount={scenarioAmount} setScenarioAmount={setScenarioAmount} scenario={scenario} /> : null}
        {route === "compare" ? <ComparePage assets={marketAssets} onOpen={openAsset} /> : null}
        {route === "ideas" ? <ResearchIdeas assets={marketAssets} onOpen={openAsset} onWatch={toggleWatchlistAsset} /> : null}
        {route === "watchlists" ? (
          <WatchlistsPage
            watchlists={watchlists}
            activeWatchlist={activeWatchlist}
            sort={watchlistSort}
            assets={marketAssets}
            onActive={setActiveWatchlist}
            onSort={setWatchlistSort}
            onCreate={createWatchlist}
            onRename={(id, name) => setWatchlists((lists) => lists.map((list) => (list.id === id ? { ...list, name } : list)))}
            onNotes={(id, notes) => setWatchlists((lists) => lists.map((list) => (list.id === id ? { ...list, notes } : list)))}
            onDelete={(id) => {
              setWatchlists((lists) => {
                const remaining = lists.filter((list) => list.id !== id);
                if (!remaining.length) return defaultWatchlists;
                setActiveWatchlist(remaining.some((list) => list.id === "default") ? "default" : remaining[0].id);
                return remaining;
              });
            }}
            onOpen={openAsset}
            onWatch={toggleWatchlistAsset}
            onExport={exportCsv}
          />
        ) : null}
        {route === "alerts" ? <AlertsPage alertRules={alertRules} setAlertRules={setAlertRules} /> : null}
        {route === "learn" ? <LearnPage terms={glossaryMatches.length ? glossaryMatches : glossaryTerms.slice(0, 18)} beginner={experience === "beginner"} /> : null}
        {route === "definitions" ? <DefinitionsPage terms={glossaryMatches.length ? glossaryMatches : glossaryTerms} /> : null}
        {route === "profile" ? <ProfilePage experience={experience} theme={theme} /> : null}
        {route === "settings" ? <SettingsPage /> : null}
        {route === "status" ? <SystemStatus lastRefresh={lastRefresh} providerRows={providerRows} runtimeStatus={runtimeStatus} /> : null}
        {["admin", "backend", "quality", "api-usage", "audit"].includes(route) ? <AdminPage route={route} runtimeStatus={runtimeStatus} /> : null}

        <div className="toast" role="status">
          {toast}
        </div>
      </main>
    </div>
  );
}

function Sidebar({
  route,
  adminMode,
  runtimeStatus,
  onRoute,
  onClose
}: {
  route: RouteId;
  adminMode: boolean;
  runtimeStatus: RuntimeStatus | null;
  onRoute: (id: RouteId) => void;
  onClose: () => void;
}) {
  return (
    <div className="sidebar-inner">
      <div className="brand-row">
        <button className="brand" type="button" onClick={() => onRoute("dashboard")}>
          <span className="brand-mark">MSD</span>
          <span>
            <strong>{appConfig.name}</strong>
            <small>Vercel-ready research platform</small>
          </span>
        </button>
        <button className="icon-button drawer-close" type="button" aria-label="Close menu" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <nav aria-label="Primary navigation">
        {navGroups.map((group) => {
          const items = group.items.filter((item) => !item.admin || adminMode);
          if (!items.length) return null;
          return (
            <div className="nav-group" key={group.title}>
              <span className="nav-group-title">{group.title}</span>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.id} className={route === item.id ? "nav-link active" : "nav-link"} type="button" onClick={() => onRoute(item.id)}>
                    <Icon size={17} />
                    <span>{item.label}</span>
                    {item.admin ? <small>Admin</small> : null}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="status-card">
        <Badge tone={runtimeStatus?.mode === "live" ? "positive" : runtimeStatus?.mode === "unavailable" ? "negative" : "warning"}>
          {runtimeStatus?.applicationMode ?? "Checking"}
        </Badge>
        <p>
          {runtimeStatus
            ? `Stocks: ${runtimeStatus.stockMarketStatus}. Crypto: ${runtimeStatus.cryptoMarketStatus}. Cron: backend ingestion scheduled daily at 09:00 UTC.`
            : "Runtime status is loading from the internal API."}
        </p>
      </div>
    </div>
  );
}

function GlobalSearch({
  query,
  searchOpen,
  matches,
  recentSearches,
  activeSuggestion,
  loading,
  error,
  searchRef,
  onQuery,
  onOpen,
  onSubmit,
  onKeyDown,
  onAsset
}: {
  query: string;
  searchOpen: boolean;
  matches: SearchResult[];
  recentSearches: string[];
  activeSuggestion: number;
  loading: boolean;
  error: string;
  searchRef: React.RefObject<HTMLDivElement | null>;
  onQuery: (value: string) => void;
  onOpen: (open: boolean) => void;
  onSubmit: (event: FormEvent) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onAsset: (result: SearchResult) => void;
}) {
  const activeId = matches[activeSuggestion] ? `asset-search-option-${matches[activeSuggestion].symbol.replace(/[^A-Za-z0-9_-]/g, "-")}` : undefined;
  return (
    <div className="search-shell" ref={searchRef}>
      <form className="search" onSubmit={onSubmit} role="search">
        <Search size={18} />
        <label className="sr-only" htmlFor="global-search">
          Search stocks, crypto, ETFs, or indexes
        </label>
        <input
          id="global-search"
          role="combobox"
          aria-expanded={searchOpen}
          aria-controls="asset-search-results"
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          value={query}
          onChange={(event) => {
            onQuery(event.target.value);
            onOpen(true);
          }}
          onFocus={() => onOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search ticker, company, ETF, index, or term"
        />
        <button type="submit">Search</button>
      </form>
      {searchOpen ? (
        <div className="search-popover" id="asset-search-results" role="listbox">
          {loading ? <div className="empty-search" role="status">Searching providers...</div> : null}
          {error ? <div className="empty-search warning" role="status">{error}</div> : null}
          {query && !loading && !matches.length ? (
            <div className="empty-search">
              <strong>Asset not found</strong>
              <span>No provider or local fallback matched this search. No substitute ticker was selected.</span>
            </div>
          ) : null}
          {matches.map((result, index) => (
            <button
              key={`${result.provider}-${result.symbol}`}
              id={`asset-search-option-${result.symbol.replace(/[^A-Za-z0-9_-]/g, "-")}`}
              className={index === activeSuggestion ? "search-option active" : "search-option"}
              type="button"
              role="option"
              aria-selected={index === activeSuggestion}
              onClick={() => onAsset(result)}
            >
              <span>
                <strong>{result.symbol}</strong>
                <small>{result.name}</small>
              </span>
              <span className="search-provider">
                <Badge tone={statusSeverity(result.dataStatus)}>{result.dataStatus}</Badge>
                <small>{result.provider}</small>
              </span>
            </button>
          ))}
          {!query && recentSearches.length ? (
            <div className="recent-searches">
              <span className="nav-group-title">Recent searches</span>
              {recentSearches.map((symbol) => (
                <button
                  type="button"
                  className="small-button"
                  key={symbol}
                  onClick={() =>
                    onAsset({
                      symbol,
                      name: symbol,
                      type: symbol.endsWith("-USD") ? "crypto" : "stock",
                      provider: "Demo Fixture Provider",
                      dataStatus: "Demo"
                    })
                  }
                >
                  {symbol}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TickerTape({ assets, onOpen }: { assets: Asset[]; onOpen: (symbol: string) => void }) {
  return (
    <section className="ticker-tape" aria-label="Market ticker tape">
      {assets.map((asset) => (
        <button key={asset.symbol} className="ticker-pill" type="button" onClick={() => onOpen(asset.symbol)}>
          <strong>{asset.symbol}</strong>
          <span>{currency(asset.price)}</span>
          <span className={asset.changePercent >= 0 ? "positive" : "negative"}>{percent(asset.changePercent)}</span>
          <span className="ticker-status">{asset.meta.dataStatus}</span>
        </button>
      ))}
    </section>
  );
}

function SafetyStrip() {
  return (
    <div className="safety-strip" role="note">
      <ShieldCheck size={16} />
      <span>{appConfig.disclaimer}</span>
    </div>
  );
}

function Dashboard({
  mood,
  lastRefresh,
  refreshing,
  watchlist,
  assets,
  news,
  runtimeStatus,
  onRefresh,
  onOpen,
  onWatch
}: {
  mood: ReturnType<typeof calculateMarketMood>;
  lastRefresh: string;
  refreshing: boolean;
  watchlist: { symbols: string[]; name: string };
  assets: Asset[];
  news: NewsItem[];
  runtimeStatus: RuntimeStatus | null;
  onRefresh: () => void;
  onOpen: (symbol: string) => void;
  onWatch: (symbol: string) => void;
}) {
  const gainers = [...assets].sort((a, b) => b.changePercent - a.changePercent).slice(0, 5);
  const losers = [...assets].sort((a, b) => a.changePercent - b.changePercent).slice(0, 5);
  const trending = [...assets].sort((a, b) => b.hype - a.hype).slice(0, 5);
  const unusual = [...assets].sort((a, b) => b.relativeVolume - a.relativeVolume).slice(0, 5);
  const ranked = [...assets]
    .filter((asset) => asset.price > 0 && Number.isFinite(asset.confidence) && Number.isFinite(asset.risk))
    .map((asset) => ({
      asset,
      score:
        asset.confidence * 0.28 +
        (100 - asset.risk) * 0.24 +
        Math.max(-20, Math.min(20, asset.changePercent)) * 0.9 +
        Math.min(asset.relativeVolume, 3) * 7 +
        (asset.meta.dataStatus === "Demo" ? -8 : 8)
    }))
    .sort((a, b) => b.score - a.score);
  const bestSetup = ranked[0]?.asset ?? assets[0] ?? demoAssets[0];
  const bestInputs = [
    `confidence ${bestSetup.confidence}`,
    `risk ${bestSetup.risk}`,
    `momentum ${percent(bestSetup.changePercent)}`,
    `relative volume ${bestSetup.relativeVolume || "unavailable"}`,
    `data ${bestSetup.meta.dataStatus}`
  ];
  const watchAssets = assets.filter((asset) => watchlist.symbols.includes(asset.symbol));
  const indexes = assets.filter((asset) => asset.type === "index" || asset.type === "etf").slice(0, 5);
  const liveCount = assets.filter((asset) => asset.meta.dataStatus === "Live" || asset.meta.dataStatus === "Delayed").length;
  const providerLabel = runtimeStatus?.applicationMode ?? "Checking";
  const easternTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short"
  }).format(new Date());

  return (
    <section className="page">
      <PageTitle eyebrow="Dashboard" title="Market command center" copy="A premium market home screen ordered by freshness, watchlist, indexes, movers, news, setup quality, sentiment, and daily summary." />
      <section className="feature-panel status-hero">
        <div>
          <span className="eyebrow">Market status and data freshness</span>
          <h2>Market status: {runtimeStatus?.marketStatus ?? "checking"}</h2>
          <p>
            Eastern Time {easternTime} | Last successful update {formatDateTime(lastRefresh)} | Mode: {providerLabel}
          </p>
        </div>
        <div className="status-actions">
          <Badge tone={liveCount ? "positive" : "warning"}>{liveCount ? `${liveCount} provider-backed assets` : "Demo Data"}</Badge>
          <span>{runtimeStatus?.cronSchedule.description ?? "Backend ingestion scheduled daily at 09:00 UTC."}</span>
          <button className="primary-button" type="button" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw size={16} /> {refreshing ? "Refreshing" : "Manual refresh"}
          </button>
        </div>
      </section>
      <div className="dashboard-grid">
        <DashboardPanel title={`Watchlist: ${watchlist.name}`} assets={watchAssets} onOpen={onOpen} onWatch={onWatch} />
        <DashboardPanel title="Major market indexes" assets={indexes} onOpen={onOpen} onWatch={onWatch} />
        <DashboardPanel title={`Top gainers (${assets.length} analyzed, ${formatDateTime(lastRefresh, false)})`} assets={gainers} onOpen={onOpen} onWatch={onWatch} />
        <DashboardPanel title={`Top losers (${assets.length} analyzed, ${formatDateTime(lastRefresh, false)})`} assets={losers} onOpen={onOpen} onWatch={onWatch} />
        <DashboardPanel title="Trending assets" assets={trending} onOpen={onOpen} onWatch={onWatch} />
        <DashboardPanel title={`Unusual volume (${assets.filter((asset) => asset.relativeVolume > 0).length} with volume data)`} assets={unusual} onOpen={onOpen} onWatch={onWatch} />
        <section className="panel">
          <h2>Market heat map</h2>
          <div className="heat-map">
            {assets.map((asset) => (
              <button key={asset.symbol} type="button" className={asset.changePercent >= 0 ? "heat-cell up" : "heat-cell down"} onClick={() => onOpen(asset.symbol)}>
                <strong>{asset.symbol}</strong>
                <span>{percent(asset.changePercent)}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>Important market news</h2>
          <NewsList news={news} compact onOpen={onOpen} />
        </section>
        <section className="panel">
          <h2>Best current research setup</h2>
          <AssetRow asset={bestSetup} onOpen={onOpen} onWatch={onWatch} />
          <p>Ranked from {ranked.length} assets using {bestInputs.join(", ")}. {bestSetup.meta.dataStatus === "Demo" ? "This ranking includes demo metrics and is labeled accordingly." : "Provider-backed price data was included where available."}</p>
        </section>
        <section className="panel">
          <h2>Market sentiment</h2>
          <div className="mood-meter">
            <div style={{ width: `${mood.score}%` }} />
          </div>
          <p>
            {mood.label} mood, {mood.breadth}% positive breadth, average move {percent(mood.averageChange)}.
          </p>
        </section>
        <section className="panel">
          <h2>Daily AI market summary</h2>
          <p>
            Market summary: provider-backed sections use internal API data when configured, while unavailable providers fall back to cached or demo-labeled values instead of pretending to be live.
          </p>
        </section>
      </div>
    </section>
  );
}

function DashboardPanel({ title, assets, onOpen, onWatch }: { title: string; assets: Asset[]; onOpen: (symbol: string) => void; onWatch: (symbol: string) => void }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <div className="asset-list">
        {assets.map((asset) => (
          <AssetRow key={asset.symbol} asset={asset} onOpen={onOpen} onWatch={onWatch} compact />
        ))}
      </div>
    </section>
  );
}

function AssetDetail({
  asset,
  assets,
  news,
  experience,
  onOpen,
  onWatch
}: {
  asset: Asset;
  assets: Asset[];
  news: NewsItem[];
  experience: ExperienceMode;
  onOpen: (symbol: string) => void;
  onWatch: (symbol: string) => void;
}) {
  const technicalScore = Math.round((asset.confidence + Math.max(0, 100 - asset.risk) + asset.rsi) / 3);
  const sentimentScore = Math.round((asset.sentiment + 1) * 50);
  const dataQuality = asset.meta.dataStatus === "Demo" ? 72 : 88;
  const momentum = asset.price > asset.sma50 ? "Positive trend alignment" : "Weak trend alignment";
  const priceSource = `${asset.meta.provider} - ${asset.meta.dataStatus}`;
  const calculatedSource = asset.meta.dataStatus === "Demo" ? "Demo model" : "Calculated from stored candles; timing not guaranteed";
  const volumeSource = asset.volume ? priceSource : "Unavailable from active quote provider";
  return (
    <section className="page">
      <div className="asset-header">
        <div className="asset-title">
          <span className="asset-logo large">{asset.symbol.slice(0, 2).replace("^", "I")}</span>
          <div>
            <span className="eyebrow">{asset.exchange} | {asset.type.toUpperCase()}</span>
            <h1>{asset.name}</h1>
            <p>{asset.symbol} | {asset.sector} | Last update {formatDateTime(asset.meta.lastUpdated)}</p>
          </div>
        </div>
        <div className="asset-actions">
          <button className="ghost-button" type="button" onClick={() => onWatch(asset.symbol)}>Watchlist</button>
          <button className="ghost-button" type="button" onClick={() => onOpen(asset.symbol)}>Compare</button>
          <button className="ghost-button" type="button" onClick={() => onWatch(asset.symbol)}>Alert</button>
          <DataPill asset={asset} />
        </div>
      </div>
      <div className="price-band">
        <div>
          <strong>{currency(asset.price)}</strong>
          <span className={asset.changePercent >= 0 ? "positive" : "negative"}>
            {asset.change >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            {currency(asset.change)} | {percent(asset.changePercent)}
          </span>
        </div>
        <p>{explainStatus(asset.meta)}</p>
      </div>
      <MarketChart asset={asset} advanced={experience === "advanced"} autoColor />
      {experience === "beginner" ? (
        <div className="beginner-note">
          Beginner Mode expands acronyms, explains risk, and reminds you that a signal is not advice. RSI means relative strength index, and high volatility means larger possible movement in either direction.
        </div>
      ) : null}
      <div className="grid">
        <section className="panel span-8">
          <h2>Research statistics</h2>
          <div className="stat-grid">
            <Stat label="Open" value={currency(asset.open)} />
            <Stat label="Previous close" value={currency(asset.previousClose)} />
            <Stat label="Price provenance" value={priceSource} />
            <Stat label="Volume" value={asset.volume ? compactNumber(asset.volume) : "Unavailable"} note={volumeSource} />
            <Stat label="Average volume" value={asset.averageVolume ? compactNumber(asset.averageVolume) : "Unavailable"} note={asset.meta.dataStatus === "Demo" ? "Demo fixture" : "Historical/demo fallback unless provider supplies it"} />
            <Stat label="Relative volume" value={asset.relativeVolume || "Unavailable"} note={volumeSource} />
            <Stat label="Market capitalization" value={asset.marketCap ? compactNumber(asset.marketCap) : "Not available"} />
            <Stat label="52-week high" value={currency(asset.yearHigh)} />
            <Stat label="52-week low" value={currency(asset.yearLow)} />
            <Stat label="P/E ratio" value={asset.peRatio ?? "Not available"} />
            <Stat label="EPS" value="Not available" note="Provider field required." />
            <Stat label="Dividend yield" value={asset.dividendYield !== undefined ? `${asset.dividendYield}%` : "Not available"} />
            <Stat label="Volatility" value={`${asset.volatility}/100`} />
            <Stat label="RSI" value={asset.rsi} note={calculatedSource} />
            <Stat label="Support" value={currency(asset.support)} note={calculatedSource} />
            <Stat label="Resistance" value={currency(asset.resistance)} note={calculatedSource} />
            <Stat label="Momentum" value={momentum} note={calculatedSource} />
          </div>
        </section>
        <section className="panel span-4">
          <h2>Scores</h2>
          <Badge tone={signalClass(asset.signal)}>{asset.signal}</Badge>
          <div className="score-stack">
            <Meter label="Technical" value={technicalScore} />
            <Meter label="Sentiment" value={sentimentScore} />
            <Meter label="Risk" value={asset.risk} danger />
            <Meter label="Confidence" value={asset.confidence} />
            <Meter label="Data quality" value={dataQuality} />
            <small>Risk, sentiment, and confidence are demo/calculated research metrics unless a configured model/provider writes those fields.</small>
          </div>
        </section>
      </div>
      <section className="panel">
        <h2>How was this calculated?</h2>
        <div className="method-grid">
          {[
            ["Technical score", "Uses trend alignment, RSI, moving averages, MACD, support/resistance distance, and volatility. Demo weights: trend 35%, RSI 20%, MACD 15%, volume 15%, support/resistance 15%."],
            ["Risk score", "Uses volatility, relative volume, stretched RSI, negative sentiment, and stale-data penalties. Missing provider fields lower confidence instead of being guessed."],
            ["Confidence score", "Measures evidence strength, not accuracy. It considers data freshness, indicator agreement, participation, and news tone."],
            ["Data-quality score", "Uses provider status, timestamp freshness, missing fields, duplicate checks, and whether the data is demo, cached, delayed, or live."],
            ["Last formula update", "Demo ruleset v1, updated June 15, 2026. Predictions can be wrong and are stored for later evaluation."]
          ].map(([title, copy]) => (
            <article className="method-card" key={title}>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <div className="grid">
        <section className="panel span-6">
          <h2>Related news</h2>
          <NewsList news={news} compact onOpen={onOpen} symbols={[asset.symbol]} />
        </section>
        <section className="panel span-6">
          <h2>Prediction and signal history</h2>
          <div className="timeline-list">
            <p>{asset.prediction.createdAt}: {asset.prediction.label} estimate created with {asset.prediction.confidence}/100 confidence.</p>
            <p>{asset.meta.providerTimestamp}: Signal checked against support {currency(asset.support)} and resistance {currency(asset.resistance)}.</p>
            <p>Actual result: Pending until the prediction horizon expires. Misses will remain visible.</p>
          </div>
        </section>
      </div>
      <section className="panel">
        <h2>More {asset.type} results</h2>
        <div className="asset-list">
          {assets.map((item) => (
            <AssetRow key={item.symbol} asset={item} onOpen={onOpen} onWatch={onWatch} />
          ))}
        </div>
      </section>
    </section>
  );
}

function Screener({
  type,
  search,
  sort,
  page,
  assets,
  onType,
  onSearch,
  onSort,
  onPage,
  onOpen,
  onWatch,
  onExport
}: {
  type: "all" | AssetType;
  search: string;
  sort: SortKey;
  page: number;
  assets: Asset[];
  onType: (type: "all" | AssetType) => void;
  onSearch: (value: string) => void;
  onSort: (key: SortKey) => void;
  onPage: (page: number) => void;
  onOpen: (symbol: string) => void;
  onWatch: (symbol: string) => void;
  onExport: (assets: Asset[], fileName: string) => void;
}) {
  const pageSize = 6;
  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return assets
      .filter((asset) => type === "all" || asset.type === type)
      .filter((asset) => !normalized || asset.symbol.toLowerCase().includes(normalized) || asset.name.toLowerCase().includes(normalized) || asset.sector.toLowerCase().includes(normalized))
      .sort((a, b) => {
        if (sort === "symbol") return a.symbol.localeCompare(b.symbol);
        return Number(b[sort]) - Number(a[sort]);
      });
  }, [assets, type, search, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  return (
    <section className="page">
      <PageTitle eyebrow="Screener" title="Professional market screener" copy="Filters, sorting, pagination, sticky headers, visible-data CSV export, and page-aware asset scope." />
      <section className="panel">
        <div className="toolbar">
          <label className="field inline">Asset type
            <select className="select-control" value={type} onChange={(event) => onType(event.target.value as "all" | AssetType)}>
              <option value="all">All</option>
              <option value="stock">Stocks</option>
              <option value="crypto">Crypto</option>
              <option value="etf">ETFs</option>
              <option value="index">Indexes</option>
            </select>
          </label>
          <label className="field inline">Search
            <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Filter symbol, name, sector" />
          </label>
          <label className="field inline">Sort
            <select className="select-control" value={sort} onChange={(event) => onSort(event.target.value as SortKey)}>
              <option value="confidence">Confidence</option>
              <option value="risk">Risk</option>
              <option value="changePercent">Daily change</option>
              <option value="volume">Volume</option>
              <option value="price">Price</option>
              <option value="symbol">Symbol</option>
            </select>
          </label>
          <button className="ghost-button" type="button" onClick={() => onExport(visible, `market-screener-${type}-page-${page}.csv`)}>
            <Download size={16} /> Export visible CSV
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Type</th>
                <th>Price</th>
                <th>Change</th>
                <th>Volume</th>
                <th>RSI</th>
                <th>Risk</th>
                <th>Confidence</th>
                <th>Signal</th>
                <th>Data</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((asset) => (
                <tr key={asset.symbol}>
                  <td><button className="link-button" type="button" onClick={() => onOpen(asset.symbol)}>{asset.symbol} <small>{asset.name}</small></button></td>
                  <td>{asset.type}</td>
                  <td>{currency(asset.price)}</td>
                  <td className={asset.changePercent >= 0 ? "positive" : "negative"}>{percent(asset.changePercent)}</td>
                  <td>{compactNumber(asset.volume)}</td>
                  <td>{asset.rsi}</td>
                  <td>{asset.risk}</td>
                  <td>{asset.confidence}</td>
                  <td>{asset.signal}</td>
                  <td>{asset.meta.dataStatus}</td>
                  <td><button className="small-button" type="button" onClick={() => onWatch(asset.symbol)}>Watch</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button className="small-button" type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button className="small-button" type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
        </div>
      </section>
    </section>
  );
}

function ResearchIdeas({ assets, onOpen, onWatch }: { assets: Asset[]; onOpen: (symbol: string) => void; onWatch: (symbol: string) => void }) {
  const ranked = [...assets].sort((a, b) => b.confidence - b.risk - (a.confidence - a.risk)).slice(0, 6);
  return (
    <section className="page">
      <PageTitle eyebrow="Research Ideas" title="Best setups and risk queues" copy="Scanner ideas from the original site, rebuilt with clearer risk labeling and transparent reasoning." />
      <div className="grid">
        {["Heat Map Wall", "Whale Radar", "Hype vs Risk", "Red Flag Detector", "Prediction Battle Cards", "Research Queue"].map((title) => (
          <article className="scanner-card" key={title}>
            <Sparkles />
            <h2>{title}</h2>
            <p>Functional demo view using stored fixture data. Live provider enrichment activates after Vercel environment variables are configured.</p>
          </article>
        ))}
      </div>
      <section className="panel">
        <h2>Best current research setup</h2>
        <div className="asset-list">
          {ranked.map((asset) => (
            <AssetRow key={asset.symbol} asset={asset} onOpen={onOpen} onWatch={onWatch} />
          ))}
        </div>
      </section>
    </section>
  );
}

function NewsDesk({ news, onOpen }: { news: NewsItem[]; onOpen: (symbol: string) => void }) {
  return (
    <section className="page">
      <PageTitle eyebrow="Market News" title="News impact desk" copy="Headlines include source, real demo timestamp, related tickers, sentiment, impact, duplicate-detection status, and article state." />
      <div className="grid">
        <section className="panel span-8">
          <h2>Headlines</h2>
          <NewsList news={news} onOpen={onOpen} />
        </section>
        <section className="panel span-4">
          <h2>News filters</h2>
          <div className="tag-cloud">
            {["All", "Technology", "Crypto", "Indexes", "Negative tone", "High impact", "Saved"].map((label) => (
              <button className="small-button" type="button" key={label}>{label}</button>
            ))}
          </div>
          <p>Saved articles persist after authentication is configured. Duplicate-story detection uses headline/source matching in Demo Mode.</p>
        </section>
      </div>
    </section>
  );
}

function NewsList({ news, onOpen, compact = false, symbols }: { news: NewsItem[]; onOpen: (symbol: string) => void; compact?: boolean; symbols?: string[] }) {
  const rows = symbols ? news.filter((item) => item.relatedSymbols.some((symbol) => symbols.includes(symbol))) : news;
  return (
    <div className={compact ? "news-list compact-news" : "news-list"}>
      {rows.map((item) => (
        <article className="news-card" key={item.id}>
          <div>
            <Badge tone={item.tone === "Positive" ? "positive" : item.tone === "Negative" ? "negative" : "warning"}>{item.tone}</Badge>
            <Badge tone={statusSeverity(item.dataStatus ?? "Demo")}>{item.dataStatus ?? "Demo"}</Badge>
            <h3>{item.headline}</h3>
            <p>{item.summary}</p>
            <small>{item.source} | Provider {item.provider ?? item.source} | Published {formatDateTime(item.publishedAt)} | Impact {item.impactScore}/100 | Duplicate check: headline/source</small>
          </div>
          <div className="button-row">
            {item.relatedSymbols.map((symbol) => (
              <button className="small-button" key={symbol} type="button" onClick={() => onOpen(symbol)}>{symbol}</button>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function PredictionsPage({
  selectedAsset,
  assets,
  scenarioAmount,
  setScenarioAmount,
  scenario
}: {
  selectedAsset: Asset;
  assets: Asset[];
  scenarioAmount: number;
  setScenarioAmount: (value: number) => void;
  scenario: { possibleGain: number; possibleLoss: number };
}) {
  return (
    <section className="page">
      <PageTitle eyebrow="Predictions" title="Accountable research estimates" copy="Predictions are not guaranteed outcomes. They include ranges, invalidation, model version, freshness, and eventual result tracking." />
      <div className="grid">
        <section className="panel span-5">
          <h2>{selectedAsset.symbol} estimate range</h2>
          <div className="stat-grid">
            <Stat label="Estimated low" value={currency(selectedAsset.price * (1 + selectedAsset.prediction.possibleLossPercent / 100))} />
            <Stat label="Base case" value={currency(selectedAsset.price)} />
            <Stat label="Estimated high" value={currency(selectedAsset.price * (1 + selectedAsset.prediction.possibleGainPercent / 100))} />
            <Stat label="Model" value="ruleset-demo-v1" />
          </div>
          <p>{selectedAsset.prediction.uncertainty}</p>
        </section>
        <section className="panel span-7">
          <h2>Scenario calculator</h2>
          <label className="field">Amount to model
            <input type="number" min="1" value={scenarioAmount} onChange={(event) => setScenarioAmount(Number(event.target.value))} />
          </label>
          <div className="stat-grid">
            <Stat label="Possible gain estimate" value={currency(scenario.possibleGain)} />
            <Stat label="Possible loss estimate" value={currency(scenario.possibleLoss)} />
            <Stat label="Actual result" value={selectedAsset.prediction.outcome} />
          </div>
        </section>
      </div>
      <section className="panel">
        <h2>Prediction history</h2>
        <div className="prediction-grid">
          {assets.slice(0, 6).map((asset) => (
            <article className="prediction-card" key={asset.symbol}>
              <div className="row-between">
                <strong>{asset.symbol}</strong>
                <Badge tone={signalClass(asset.prediction.label)}>{asset.prediction.label}</Badge>
              </div>
              <p>{asset.prediction.thesis[0]}</p>
              <Meter label="Confidence" value={asset.prediction.confidence} />
              <Meter label="Risk" value={asset.prediction.risk} danger />
              <small>Created {formatDateTime(asset.prediction.createdAt)} | Horizon {asset.prediction.horizon} | Result {asset.prediction.outcome}</small>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function ComparePage({ assets, onOpen }: { assets: Asset[]; onOpen: (symbol: string) => void }) {
  const compareAssets = assets.slice(0, 4);
  return (
    <section className="page">
      <PageTitle eyebrow="Compare Assets" title="Side-by-side research comparison" copy="Compare confidence, risk, data quality, signal, technical score, sentiment, and scenario ranges." />
      <div className="prediction-grid">
        {compareAssets.map((asset) => (
          <article className="prediction-card" key={asset.symbol}>
            <div className="row-between">
              <strong>{asset.symbol}</strong>
              <button className="small-button" type="button" onClick={() => onOpen(asset.symbol)}>Open</button>
            </div>
            <Stat label="Price" value={currency(asset.price)} />
            <Meter label="Confidence" value={asset.confidence} />
            <Meter label="Risk" value={asset.risk} danger />
            <Meter label="Sentiment" value={Math.round((asset.sentiment + 1) * 50)} />
          </article>
        ))}
      </div>
    </section>
  );
}

function WatchlistsPage({
  watchlists,
  activeWatchlist,
  sort,
  assets,
  onActive,
  onSort,
  onCreate,
  onRename,
  onNotes,
  onDelete,
  onOpen,
  onWatch,
  onExport
}: {
  watchlists: Watchlist[];
  activeWatchlist: string;
  sort: SortKey;
  assets: Asset[];
  onActive: (id: string) => void;
  onSort: (key: SortKey) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => void;
  onNotes: (id: string, notes: string) => void;
  onDelete: (id: string) => void;
  onOpen: (symbol: string) => void;
  onWatch: (symbol: string) => void;
  onExport: (assets: Asset[], fileName: string) => void;
}) {
  const current = watchlists.find((list) => list.id === activeWatchlist) ?? watchlists[0];
  const watchAssets = assets
    .filter((asset) => current.symbols.includes(asset.symbol))
    .sort((a, b) => (sort === "symbol" ? a.symbol.localeCompare(b.symbol) : Number(b[sort]) - Number(a[sort])));
  return (
    <section className="page">
      <PageTitle eyebrow="Watchlists" title="Multiple research watchlists" copy="Signed-out users get local watchlists. Signed-in database watchlists activate when Supabase Auth is configured." />
      <section className="panel">
        <div className="toolbar">
          <select className="select-control" value={activeWatchlist} onChange={(event) => onActive(event.target.value)}>
            {watchlists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
          </select>
          <button className="ghost-button" type="button" onClick={onCreate}>Create watchlist</button>
          <button className="ghost-button" type="button" onClick={() => onExport(watchAssets, `${current.name.toLowerCase().replaceAll(" ", "-")}.csv`)}>
            <Download size={16} /> Share/export
          </button>
          <label className="field inline">Sort
            <select className="select-control" value={sort} onChange={(event) => onSort(event.target.value as SortKey)}>
              <option value="symbol">Symbol</option>
              <option value="price">Price</option>
              <option value="changePercent">Gain/loss</option>
              <option value="volume">Volume</option>
              <option value="risk">Risk</option>
              <option value="confidence">Confidence</option>
            </select>
          </label>
        </div>
        <label className="field">Watchlist name
          <input value={current.name} onChange={(event) => onRename(current.id, event.target.value)} />
        </label>
        <label className="field">Personal notes
          <input value={current.notes} onChange={(event) => onNotes(current.id, event.target.value)} placeholder="Add research notes" />
        </label>
        <div className="asset-list">
          {watchAssets.map((asset) => <AssetRow key={asset.symbol} asset={asset} onOpen={onOpen} onWatch={onWatch} />)}
        </div>
        {current.id !== "default" ? <button className="ghost-button danger-button" type="button" onClick={() => onDelete(current.id)}>Delete watchlist</button> : null}
      </section>
    </section>
  );
}

function AlertsPage({
  alertRules,
  setAlertRules
}: {
  alertRules: AlertRule[];
  setAlertRules: React.Dispatch<React.SetStateAction<AlertRule[]>>;
}) {
  return (
    <section className="page">
      <PageTitle eyebrow="Alerts" title="Research alerts" copy="Real alert storage and delivery require authentication and notification providers. Demo alerts are clearly simulated." />
      <section className="panel">
        <div className="toolbar">
          <button
            className="primary-button"
            type="button"
            onClick={() => setAlertRules((rules) => [...rules, { id: `alert-${Date.now()}`, symbol: "AAPL", type: "Price above", value: "200", enabled: true, demo: true }])}
          >
            Add demo alert
          </button>
          <ComingSoon label="Email/SMS delivery" />
          <ComingSoon label="Quiet hours sync" />
        </div>
        <div className="alert-grid">
          {alertRules.map((rule) => (
            <article className="alert-rule-card" key={rule.id}>
              <div className="row-between">
                <strong>{rule.symbol}</strong>
                <Badge tone="warning">{rule.demo ? "Simulated Demo Alert" : "Live Alert"}</Badge>
              </div>
              <label className="field">Type
                <select className="select-control" value={rule.type} onChange={(event) => setAlertRules((rules) => rules.map((item) => item.id === rule.id ? { ...item, type: event.target.value } : item))}>
                  {["Price above", "Price below", "Percentage gain", "Percentage loss", "Unusual volume", "RSI above", "RSI below", "Signal change", "Risk increase", "Provider outage", "News event", "Earnings reminder"].map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label className="field">Value
                <input value={rule.value} onChange={(event) => setAlertRules((rules) => rules.map((item) => item.id === rule.id ? { ...item, value: event.target.value } : item))} />
              </label>
              <label className="toggle">
                <input type="checkbox" checked={rule.enabled} onChange={(event) => setAlertRules((rules) => rules.map((item) => item.id === rule.id ? { ...item, enabled: event.target.checked } : item))} />
                Enabled
              </label>
              <button className="small-button" type="button" onClick={() => setAlertRules((rules) => rules.filter((item) => item.id !== rule.id))}>Delete</button>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function LearnPage({ terms, beginner }: { terms: typeof glossaryTerms; beginner: boolean }) {
  return (
    <section className="page">
      <PageTitle eyebrow="Learn" title="Market education" copy="Beginner mode changes the interface by expanding acronyms, adding risk warnings, and showing practical examples." />
      {beginner ? <div className="beginner-note">Beginner Mode is active: high-risk concepts are labeled, acronyms are expanded, and examples are shown before formulas.</div> : null}
      <div className="glossary-grid">
        {terms.map((item) => (
          <article className="glossary-card" key={item.term}>
            <span className="eyebrow">{item.category}</span>
            <h3>{item.term}</h3>
            <p>{item.shortDefinition}</p>
            <small>{item.beginnerExample}</small>
            {item.formula ? <code>{item.formula}</code> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function DefinitionsPage({ terms }: { terms: typeof glossaryTerms }) {
  return (
    <section className="page">
      <PageTitle eyebrow="Keyword Definitions" title="Searchable financial glossary" copy="Each definition includes why it matters, an example, a common misunderstanding, and related terms." />
      <div className="glossary-grid">
        {terms.map((item) => (
          <article className="glossary-card" key={item.term}>
            <h3>{item.term}</h3>
            <p>{item.fullDefinition}</p>
            <p><strong>Why it matters:</strong> It helps evaluate market evidence without treating a single metric as advice.</p>
            <p><strong>Common misunderstanding:</strong> A strong reading does not guarantee a future move.</p>
            <small>Related: {item.related.join(", ") || "None listed"}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProfilePage({ experience, theme }: { experience: ExperienceMode; theme: string }) {
  return (
    <section className="page">
      <PageTitle eyebrow="Profile" title="Account profile" copy={hasSupabaseConfig ? "Supabase Auth is configured." : "Authentication is unavailable until Supabase environment variables are configured in Vercel."} />
      <section className="panel">
        <div className="auth-grid">
          <label className="field">Email<input disabled placeholder="Configure Supabase Auth to enable email signup" /></label>
          <label className="field">Password<input disabled type="password" placeholder="Demo Mode disabled" /></label>
          <button className="primary-button" type="button" disabled>Auth setup required</button>
          <button className="ghost-button" type="button" disabled>Google sign-in Coming Soon</button>
        </div>
        <p>{appConfig.minAgeCopy}</p>
        <div className="stat-grid">
          <Stat label="Role" value="Guest" />
          <Stat label="Experience mode" value={experience} />
          <Stat label="Theme" value={theme} />
          <Stat label="Account deletion" value="Coming Soon" />
        </div>
      </section>
    </section>
  );
}

function SettingsPage() {
  return (
    <section className="page">
      <PageTitle eyebrow="Settings" title="Research preferences" copy="Settings are local in Demo Mode and become database-backed after authentication is configured." />
      <section className="panel">
        <Badge tone="warning">Admin access protected</Badge>
        <p>Admin tools require Supabase Auth plus an admin role check. They are not enabled by a browser checkbox.</p>
        <p>Notification preferences, quiet hours, and saved default watchlists require signed-in database storage.</p>
      </section>
    </section>
  );
}

function AssetNotFoundPage({ symbol, onRoute }: { symbol: string; onRoute: (route: RouteId) => void }) {
  return (
    <section className="page">
      <PageTitle eyebrow="Not found" title={`${symbol} is not available`} copy="This asset URL is valid, but the current providers and demo fallback did not return a matching asset. No nearby ticker was substituted." />
      <section className="panel">
        <p>Try the global search, return to a market list, or add provider keys in Vercel to expand supported symbols.</p>
        <div className="button-row">
          <button className="primary-button" type="button" onClick={() => onRoute("screener")}>Open screener</button>
          <button className="ghost-button" type="button" onClick={() => onRoute("dashboard")}>Back to dashboard</button>
        </div>
      </section>
    </section>
  );
}

function SystemStatus({
  lastRefresh,
  providerRows,
  runtimeStatus
}: {
  lastRefresh: string;
  providerRows: ProviderHealth[];
  runtimeStatus: RuntimeStatus | null;
}) {
  const runtimeProviders = runtimeStatus?.providers ?? [];
  return (
    <section className="page">
      <PageTitle eyebrow="Data Status" title="Public system status" copy="Provider health, delay, latency, outage, freshness, and Demo Mode state are visible without exposing secrets." />
      <section className="panel">
        <div className="stat-grid">
          <Stat label="Runtime mode" value={runtimeStatus?.mode ?? "checking"} />
          <Stat label="Stock market" value={runtimeStatus?.stockMarketStatus ?? "checking"} />
          <Stat label="Crypto market" value={runtimeStatus?.cryptoMarketStatus ?? "checking"} />
          <Stat label="Supabase public config" value={runtimeStatus?.supabasePublicConfigured ? "Configured" : "Missing"} />
          <Stat label="Supabase server config" value={runtimeStatus?.supabaseServerConfigured ? "Configured" : "Missing"} />
          <Stat label="Cron" value={runtimeStatus?.cronSchedule.description ?? "checking"} />
          <Stat label="Cache backend" value={runtimeStatus?.cacheBackend.kind ?? "checking"} note={runtimeStatus?.cacheBackend.note} />
        </div>
      </section>
      <div className="grid">
        {runtimeProviders.map((item) => (
          <section className="panel span-4" key={item.name}>
            <h2>{item.name}</h2>
            <Badge tone={item.configured ? "positive" : "warning"}>{item.configured ? "Configured" : "Missing key"}</Badge>
            <p>{item.status}</p>
            <small>
              Supports: {item.supports.join(", ")} | Freshness: {item.dataFreshness} | Fallback active: {item.fallbackActive ? "yes" : "no"} | Rate limit: {item.rateLimitState}
            </small>
          </section>
        ))}
        {!runtimeProviders.length ? providerRows.map((item) => (
          <section className="panel span-4" key={item.provider}>
            <h2>{item.provider}</h2>
            <Badge tone={item.marketData === "Healthy" ? "positive" : "warning"}>Market {item.marketData}</Badge>
            <Badge tone={item.newsData === "Healthy" ? "positive" : "warning"}>News {item.newsData}</Badge>
            <p>{item.notes}</p>
            <small>Last successful update: {formatDateTime(lastRefresh)} | Delay: Demo snapshot | API latency: not measured</small>
          </section>
        )) : null}
      </div>
    </section>
  );
}

function AdminPage({ route, runtimeStatus }: { route: RouteId; runtimeStatus: RuntimeStatus | null }) {
  if (!runtimeStatus?.supabasePublicConfigured || !runtimeStatus?.supabaseServerConfigured) {
    return (
      <section className="page">
        <PageTitle eyebrow="Protected Admin" title="Admin access unavailable" copy="Admin tools require Supabase Auth, a profile role of admin, and server-side role checks. A browser checkbox cannot unlock this area." />
        <section className="panel">
          <div className="stat-grid">
            <Stat label="Auth configured" value={runtimeStatus?.supabasePublicConfigured ? "Configured" : "Missing"} />
            <Stat label="Server role check" value={runtimeStatus?.supabaseServerConfigured ? "Configured" : "Missing"} />
            <Stat label="Admin API" value="/api/admin/diagnostics returns 401 until an admin session is supplied" />
          </div>
        </section>
      </section>
    );
  }
  const rows = [
    ["Provider health", runtimeStatus ? `${runtimeStatus.mode} mode with ${runtimeStatus.providers.filter((provider) => provider.configured).length} configured providers.` : "Checking runtime provider status."],
    ["API usage", "Browser calls only internal Next.js API routes; provider keys stay server-side."],
    ["Failed jobs", "None in Demo Mode."],
    ["Retry queues", "Scan-request queue schema exists."],
    ["Database growth", runtimeStatus?.supabaseServerConfigured ? "Supabase server credentials configured." : "Supabase migrations ready; service credentials not configured here."],
    ["Audit logs", "Admin audit table defined; service-role writes only."]
  ];
  return (
    <section className="page">
      <PageTitle eyebrow="Protected Admin" title={route.replace("-", " ")} copy="Admin pages are hidden unless local admin preview is enabled. Production access must be enforced by Supabase role policies." />
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Area</th><th>Status</th></tr></thead>
            <tbody>{rows.map(([area, status]) => <tr key={area}><td>{area}</td><td>{status}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function fuzzySearchAssets(query: string, assets: Asset[]) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return assets
    .map((asset) => {
      const haystack = `${asset.symbol} ${asset.name} ${asset.type} ${asset.sector}`.toLowerCase();
      const direct = haystack.includes(normalized) ? 10 : 0;
      const fuzzy = normalized.split("").every((char) => haystack.includes(char)) ? 2 : 0;
      return { asset, score: direct + fuzzy + (asset.symbol.toLowerCase().startsWith(normalized) ? 5 : 0) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.asset);
}
