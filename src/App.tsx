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
import { hasSupabaseConfig } from "./supabaseClient";
import type { Asset, AssetType, NewsItem, ProviderHealth, SignalLabel } from "./types";
import type { HistoryEnvelope, RuntimeStatus } from "./services/marketData";

type RouteId =
  | "dashboard"
  | "stocks"
  | "crypto"
  | "etfs"
  | "indexes"
  | "news"
  | "screener"
  | "predictions"
  | "compare"
  | "ideas"
  | "watchlists"
  | "alerts"
  | "learn"
  | "definitions"
  | "profile"
  | "settings"
  | "status"
  | "admin"
  | "backend"
  | "quality"
  | "api-usage"
  | "audit";

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

export default function App() {
  const [route, setRoute] = useState<RouteId>("dashboard");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [experience, setExperience] = useState<ExperienceMode>("beginner");
  const [adminMode, setAdminMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState("MSFT");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [toast, setToast] = useState("Demo Mode active. Add provider keys in Vercel to enable live data.");
  const [lastRefresh, setLastRefresh] = useState("2026-06-15T14:36:03-04:00");
  const [refreshing, setRefreshing] = useState(false);
  const [marketAssets, setMarketAssets] = useState<Asset[]>(demoAssets);
  const [marketNews, setMarketNews] = useState<NewsItem[]>(demoNews);
  const [providerRows, setProviderRows] = useState<ProviderHealth[]>(providerHealth);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);
  const [watchlists, setWatchlists] = useState([
    { id: "default", name: "Default Research", symbols: ["MSFT", "SPY", "BTC-USD"], notes: "Demo local watchlist." },
    { id: "risk", name: "High Risk Watch", symbols: ["TSLA", "SOL-USD"], notes: "Keep position sizing research conservative." }
  ]);
  const [activeWatchlist, setActiveWatchlist] = useState("default");
  const [watchlistSort, setWatchlistSort] = useState<SortKey>("symbol");
  const [alertRules, setAlertRules] = useState([
    { id: "price-msft", symbol: "MSFT", type: "Price above", value: "490", enabled: true, demo: true },
    { id: "risk-tsla", symbol: "TSLA", type: "Risk increase", value: "75", enabled: true, demo: true }
  ]);
  const [screenerType, setScreenerType] = useState<"all" | AssetType>("all");
  const [screenerSearch, setScreenerSearch] = useState("");
  const [screenerSort, setScreenerSort] = useState<SortKey>("confidence");
  const [screenerPage, setScreenerPage] = useState(1);
  const [scenarioAmount, setScenarioAmount] = useState(1000);
  const searchRef = useRef<HTMLDivElement | null>(null);

  const selectedAsset = marketAssets.find((asset) => asset.symbol === selectedSymbol) ?? marketAssets[0] ?? demoAssets[0];
  const mood = useMemo(() => calculateMarketMood(marketAssets), [marketAssets]);
  const currentWatchlist = watchlists.find((list) => list.id === activeWatchlist) ?? watchlists[0];
  const marketScope = routeAssetType[route];
  const scopedAssets = marketScope ? marketAssets.filter((asset) => asset.type === marketScope) : marketAssets;
  const searchMatches = useMemo(() => fuzzySearchAssets(query, marketAssets).slice(0, 7), [query, marketAssets]);
  const glossaryMatches = useMemo(() => searchGlossary(query).slice(0, 18), [query]);
  const scenario = calculateScenario({
    amount: scenarioAmount,
    possibleGainPercent: selectedAsset.prediction.possibleGainPercent,
    possibleLossPercent: selectedAsset.prediction.possibleLossPercent
  });

  useEffect(() => {
    const saved = localStorage.getItem("msd-recent-searches");
    if (saved) setRecentSearches(JSON.parse(saved) as string[]);
  }, []);

  useEffect(() => {
    localStorage.setItem("msd-recent-searches", JSON.stringify(recentSearches.slice(0, 6)));
  }, [recentSearches]);

  useEffect(() => {
    setActiveSuggestion(0);
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

  const openRoute = (id: RouteId) => {
    setRoute(id);
    setMobileMenuOpen(false);
  };

  const openAsset = (symbol: string) => {
    const asset = marketAssets.find((item) => item.symbol === symbol);
    if (!asset) {
      setToast("Asset not found. Use search suggestions or return to search.");
      return;
    }
    setSelectedSymbol(symbol);
    setRoute(asset.type === "stock" ? "stocks" : asset.type === "crypto" ? "crypto" : asset.type === "etf" ? "etfs" : "indexes");
    setQuery("");
    setSearchOpen(false);
    setRecentSearches((current) => [symbol, ...current.filter((item) => item !== symbol)].slice(0, 6));
    setToast(`${symbol} opened with stored ${asset.meta.dataStatus} data.`);
    void loadAssetHistory(asset);
  };

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (searchMatches[0]) openAsset(searchMatches[0].symbol);
    else setToast("Asset not found. Suggested matches appear when the search matches a supported asset.");
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
      openAsset(searchMatches[activeSuggestion].symbol);
    }
    if (event.key === "Escape") setSearchOpen(false);
  };

  const refreshData = async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/refresh", { method: "POST" });
      const payload = (await response.json()) as { status: string; lastUpdated: string; message: string };
      await loadMarkets(true);
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
      onRoute={openRoute}
      onAdminMode={setAdminMode}
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
            searchRef={searchRef}
            onQuery={setQuery}
            onOpen={setSearchOpen}
            onSubmit={handleSearchSubmit}
            onKeyDown={handleSearchKeyDown}
            onAsset={openAsset}
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
        {["stocks", "crypto", "etfs", "indexes"].includes(route) ? (
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
              setWatchlists((lists) => lists.filter((list) => list.id !== id));
              setActiveWatchlist("default");
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
        {route === "settings" ? <SettingsPage adminMode={adminMode} setAdminMode={setAdminMode} /> : null}
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
  onRoute,
  onAdminMode,
  onClose
}: {
  route: RouteId;
  adminMode: boolean;
  onRoute: (id: RouteId) => void;
  onAdminMode: (enabled: boolean) => void;
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
      <label className="toggle admin-toggle">
        <input type="checkbox" checked={adminMode} onChange={(event) => onAdminMode(event.target.checked)} />
        Show admin tools
      </label>
      <div className="status-card">
        <Badge tone="warning">Demo Mode</Badge>
        <p>Provider keys are missing. Demo fixtures are fixed, timestamped, and never presented as live prices.</p>
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
  searchRef,
  onQuery,
  onOpen,
  onSubmit,
  onKeyDown,
  onAsset
}: {
  query: string;
  searchOpen: boolean;
  matches: Asset[];
  recentSearches: string[];
  activeSuggestion: number;
  searchRef: React.RefObject<HTMLDivElement | null>;
  onQuery: (value: string) => void;
  onOpen: (open: boolean) => void;
  onSubmit: (event: FormEvent) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onAsset: (symbol: string) => void;
}) {
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
          {query && !matches.length ? (
            <div className="empty-search">
              <strong>Asset not found</strong>
              <span>Try MSFT, AAPL, SPY, BTC-USD, or search from the screener.</span>
            </div>
          ) : null}
          {matches.map((asset, index) => (
            <button
              key={asset.symbol}
              className={index === activeSuggestion ? "search-option active" : "search-option"}
              type="button"
              role="option"
              aria-selected={index === activeSuggestion}
              onClick={() => onAsset(asset.symbol)}
            >
              <span>
                <strong>{asset.symbol}</strong>
                <small>{asset.name}</small>
              </span>
              <Badge tone={statusSeverity(asset.meta.dataStatus)}>{asset.meta.dataStatus}</Badge>
            </button>
          ))}
          {!query && recentSearches.length ? (
            <div className="recent-searches">
              <span className="nav-group-title">Recent searches</span>
              {recentSearches.map((symbol) => (
                <button type="button" className="small-button" key={symbol} onClick={() => onAsset(symbol)}>
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
  const watchAssets = assets.filter((asset) => watchlist.symbols.includes(asset.symbol));
  const indexes = assets.filter((asset) => asset.type === "index" || asset.type === "etf").slice(0, 5);
  const liveCount = assets.filter((asset) => asset.meta.dataStatus === "Live" || asset.meta.dataStatus === "Delayed").length;
  const providerLabel = runtimeStatus?.mode === "demo" ? "Demo fallback" : runtimeStatus?.mode === "mixed" ? "Mixed provider data" : "Live providers";
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
            Eastern Time {easternTime} | Last successful update {formatDateTime(lastRefresh)} | Source: {providerLabel}
          </p>
        </div>
        <div className="status-actions">
          <Badge tone={liveCount ? "positive" : "warning"}>{liveCount ? `${liveCount} provider-backed assets` : "Demo Data"}</Badge>
          <span>Next automatic refresh: Vercel cron configured in vercel.json</span>
          <button className="primary-button" type="button" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw size={16} /> {refreshing ? "Refreshing" : "Manual refresh"}
          </button>
        </div>
      </section>
      <div className="dashboard-grid">
        <DashboardPanel title={`Watchlist: ${watchlist.name}`} assets={watchAssets} onOpen={onOpen} onWatch={onWatch} />
        <DashboardPanel title="Major market indexes" assets={indexes} onOpen={onOpen} onWatch={onWatch} />
        <DashboardPanel title="Top gainers" assets={gainers} onOpen={onOpen} onWatch={onWatch} />
        <DashboardPanel title="Top losers" assets={losers} onOpen={onOpen} onWatch={onWatch} />
        <DashboardPanel title="Trending assets" assets={trending} onOpen={onOpen} onWatch={onWatch} />
        <DashboardPanel title="Unusual volume" assets={unusual} onOpen={onOpen} onWatch={onWatch} />
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
          <AssetRow asset={assets[0] ?? demoAssets[0]} onOpen={onOpen} onWatch={onWatch} />
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
            <Stat label="Volume" value={asset.volume ? compactNumber(asset.volume) : "Not available"} />
            <Stat label="Average volume" value={compactNumber(asset.averageVolume)} />
            <Stat label="Relative volume" value={asset.relativeVolume || "Not available"} />
            <Stat label="Market capitalization" value={asset.marketCap ? compactNumber(asset.marketCap) : "Not available"} />
            <Stat label="52-week high" value={currency(asset.yearHigh)} />
            <Stat label="52-week low" value={currency(asset.yearLow)} />
            <Stat label="P/E ratio" value={asset.peRatio ?? "Not available"} />
            <Stat label="EPS" value="Not available" note="Provider field required." />
            <Stat label="Dividend yield" value={asset.dividendYield !== undefined ? `${asset.dividendYield}%` : "Not available"} />
            <Stat label="Volatility" value={`${asset.volatility}/100`} />
            <Stat label="RSI" value={asset.rsi} />
            <Stat label="Support" value={currency(asset.support)} />
            <Stat label="Resistance" value={currency(asset.resistance)} />
            <Stat label="Momentum" value={momentum} />
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
            <h3>{item.headline}</h3>
            <p>{item.summary}</p>
            <small>{item.source} | Published {formatDateTime(item.publishedAt)} | Impact {item.impactScore}/100 | Duplicate check: unique demo story</small>
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
  watchlists: Array<{ id: string; name: string; symbols: string[]; notes: string }>;
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
  alertRules: Array<{ id: string; symbol: string; type: string; value: string; enabled: boolean; demo: boolean }>;
  setAlertRules: React.Dispatch<React.SetStateAction<Array<{ id: string; symbol: string; type: string; value: string; enabled: boolean; demo: boolean }>>>;
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

function SettingsPage({ adminMode, setAdminMode }: { adminMode: boolean; setAdminMode: (value: boolean) => void }) {
  return (
    <section className="page">
      <PageTitle eyebrow="Settings" title="Research preferences" copy="Settings are local in Demo Mode and become database-backed after authentication is configured." />
      <section className="panel">
        <label className="toggle big">
          <input type="checkbox" checked={adminMode} onChange={(event) => setAdminMode(event.target.checked)} />
          Show admin pages for local review
        </label>
        <p>Notification preferences, quiet hours, and saved default watchlists require signed-in database storage.</p>
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
          <Stat label="Market status" value={runtimeStatus?.marketStatus ?? "checking"} />
          <Stat label="Supabase public config" value={runtimeStatus?.supabasePublicConfigured ? "Configured" : "Missing"} />
          <Stat label="Supabase server config" value={runtimeStatus?.supabaseServerConfigured ? "Configured" : "Missing"} />
        </div>
      </section>
      <div className="grid">
        {runtimeProviders.map((item) => (
          <section className="panel span-4" key={item.name}>
            <h2>{item.name}</h2>
            <Badge tone={item.configured ? "positive" : "warning"}>{item.configured ? "Configured" : "Missing key"}</Badge>
            <p>{item.status}</p>
            <small>Supports: {item.supports.join(", ")} | Server-side only: {item.serverSideOnly ? "yes" : "no"}</small>
          </section>
        ))}
        {providerRows.map((item) => (
          <section className="panel span-4" key={item.provider}>
            <h2>{item.provider}</h2>
            <Badge tone={item.marketData === "Healthy" ? "positive" : "warning"}>Market {item.marketData}</Badge>
            <Badge tone={item.newsData === "Healthy" ? "positive" : "warning"}>News {item.newsData}</Badge>
            <p>{item.notes}</p>
            <small>Last successful update: {formatDateTime(lastRefresh)} | Delay: Demo snapshot | API latency: not measured</small>
          </section>
        ))}
      </div>
    </section>
  );
}

function AdminPage({ route, runtimeStatus }: { route: RouteId; runtimeStatus: RuntimeStatus | null }) {
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
