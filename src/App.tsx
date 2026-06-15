import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Gauge,
  Home,
  LineChart,
  Lock,
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
  WalletCards,
  Zap
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type React from "react";
import { appConfig, routeLabels, type RouteLabel } from "./config";
import { demoAssets, demoNews, optionResearchState, providerHealth } from "./data/fixtures";
import { glossaryTerms, searchGlossary } from "./data/glossary";
import { calculateMarketMood, calculateScenario } from "./lib/calculations";
import { compactNumber, currency, formatDateTime, percent } from "./lib/format";
import { explainStatus, statusSeverity } from "./lib/dataStatus";
import { hasSupabaseConfig } from "./supabaseClient";
import { MarketChart } from "./components/MarketChart";
import type { Asset, SignalLabel } from "./types";
import "./styles.css";

const iconMap: Partial<Record<RouteLabel, typeof Home>> = {
  Launch: Home,
  Dashboard: Gauge,
  Markets: Activity,
  Stocks: LineChart,
  Crypto: CircleDollarSign,
  ETFs: Briefcase,
  Indexes: BarChart3,
  Options: WalletCards,
  "Research Ideas": Sparkles,
  News: Newspaper,
  Predictions: Target,
  Compare: BarChart3,
  Screeners: Search,
  Watchlists: Bell,
  Alerts: Zap,
  Learn: BookOpen,
  "System Status": ShieldCheck,
  Account: User,
  Settings: Settings,
  "Admin Dashboard": Lock,
  "Backend Jobs": Activity,
  "Data Quality": CheckCircle2
};

const signalClass = (signal: SignalLabel) => {
  if (signal === "Watch") return "positive";
  if (signal === "Avoid") return "negative";
  return "warning";
};

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function DataPill({ asset }: { asset: Asset }) {
  return <Badge tone={statusSeverity(asset.meta.dataStatus)}>{asset.meta.dataStatus}</Badge>;
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

function AssetRow({ asset, onOpen, onWatch }: { asset: Asset; onOpen: (symbol: string) => void; onWatch: (symbol: string) => void }) {
  return (
    <article className="asset-row">
      <button className="asset-identity" type="button" onClick={() => onOpen(asset.symbol)}>
        <span className="asset-logo">{asset.symbol.slice(0, 2).replace("^", "I")}</span>
        <span>
          <strong>{asset.symbol}</strong>
          <small>{asset.name}</small>
        </span>
      </button>
      <span>{asset.type.toUpperCase()}</span>
      <span className="number">{currency(asset.price, asset.price > 1000 ? 2 : 2)}</span>
      <span className={asset.changePercent >= 0 ? "positive" : "negative"}>{percent(asset.changePercent)}</span>
      <Badge tone={signalClass(asset.signal)}>{asset.signal}</Badge>
      <span>Risk {asset.risk}</span>
      <DataPill asset={asset} />
      <button className="small-button" type="button" onClick={() => onWatch(asset.symbol)}>
        Watchlist
      </button>
    </article>
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

export default function App() {
  const [route, setRoute] = useState<RouteLabel>("Launch");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [beginner, setBeginner] = useState(true);
  const [compact, setCompact] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [autoColor, setAutoColor] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState("MSFT");
  const [searchText, setSearchText] = useState("");
  const [toast, setToast] = useState("Demo Mode active. Configure GitHub Actions secrets for live ingestion.");
  const [watchlist, setWatchlist] = useState<string[]>(["MSFT", "SPY", "BTC-USD"]);
  const [scenarioAmount, setScenarioAmount] = useState(1000);
  const selectedAsset = demoAssets.find((asset) => asset.symbol === selectedSymbol) ?? demoAssets[0];
  const mood = useMemo(() => calculateMarketMood(demoAssets), []);
  const filteredAssets = useMemo(() => {
    const normalized = searchText.trim().toLowerCase();
    if (!normalized) return demoAssets;
    return demoAssets.filter(
      (asset) =>
        asset.symbol.toLowerCase().includes(normalized) ||
        asset.name.toLowerCase().includes(normalized) ||
        asset.type.includes(normalized)
    );
  }, [searchText]);
  const scenario = calculateScenario({
    amount: scenarioAmount,
    possibleGainPercent: selectedAsset.prediction.possibleGainPercent,
    possibleLossPercent: selectedAsset.prediction.possibleLossPercent
  });
  const glossaryMatches = useMemo(() => searchGlossary(searchText), [searchText]);

  const openAsset = (symbol: string) => {
    setSelectedSymbol(symbol);
    setRoute("Markets");
    setToast(`${symbol} opened with stored ${demoAssets.find((asset) => asset.symbol === symbol)?.meta.dataStatus} data.`);
  };

  const toggleWatchlist = (symbol: string) => {
    setWatchlist((current) => {
      const exists = current.includes(symbol);
      setToast(exists ? `${symbol} removed from your local demo watchlist.` : `${symbol} added to your local demo watchlist.`);
      return exists ? current.filter((item) => item !== symbol) : [...current, symbol];
    });
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const match = filteredAssets[0];
    if (match) openAsset(match.symbol);
    else setToast("Unsupported ticker. A refresh request would be stored in Supabase when authentication is configured.");
  };

  return (
    <div className={`app ${theme} ${compact ? "compact" : ""}`}>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => setRoute("Launch")}>
          <span className="brand-mark">MSD</span>
          <span>
            <strong>{appConfig.name}</strong>
            <small>{appConfig.versionLabel}</small>
          </span>
        </button>
        <nav aria-label="Primary navigation">
          {routeLabels.map((label) => {
            const Icon = iconMap[label] ?? ChevronRight;
            const admin = label.includes("Admin") || label.includes("Backend") || label.includes("Quality");
            return (
              <button key={label} className={route === label ? "nav-link active" : "nav-link"} type="button" onClick={() => setRoute(label)}>
                <Icon size={17} />
                <span>{label}</span>
                {admin ? <small>Admin</small> : null}
              </button>
            );
          })}
        </nav>
        <div className="status-card">
          <Badge tone="warning">Demo Mode</Badge>
          <p>Fixed fixture data only. Secure provider ingestion runs through GitHub Actions when secrets are added.</p>
        </div>
      </aside>

      <main className="main" id="content">
        <header className="topbar">
          <form className="search" onSubmit={submitSearch}>
            <Search size={18} />
            <label className="sr-only" htmlFor="global-search">
              Search ticker or glossary term
            </label>
            <input
              id="global-search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search ticker, asset, or glossary"
            />
            <button type="submit">Search</button>
          </form>
          <div className="top-actions">
            <button className="ghost-button" type="button" onClick={() => setToast("Refresh requested. Secure backend workflow will process queued real-data requests.")}>
              <RefreshCw size={16} /> Refresh
            </button>
            <label className="toggle">
              <input type="checkbox" checked={beginner} onChange={(event) => setBeginner(event.target.checked)} />
              Beginner
            </label>
            <label className="toggle">
              <input type="checkbox" checked={compact} onChange={(event) => setCompact(event.target.checked)} />
              Compact
            </label>
            <button className="icon-button" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <section className="ticker-tape" aria-label="Market ticker tape">
          {demoAssets.map((asset) => (
            <button key={asset.symbol} className="ticker-pill" type="button" onClick={() => openAsset(asset.symbol)}>
              <strong>{asset.symbol}</strong>
              <span>{currency(asset.price)}</span>
              <span className={asset.changePercent >= 0 ? "positive" : "negative"}>{percent(asset.changePercent)}</span>
            </button>
          ))}
        </section>

        <SafetyStrip />

        {route === "Launch" ? (
          <Landing
            selectedAsset={selectedAsset}
            mood={mood}
            onRoute={setRoute}
            onOpen={openAsset}
            onWatch={toggleWatchlist}
            beginner={beginner}
          />
        ) : null}
        {route === "Dashboard" ? <Dashboard mood={mood} onOpen={openAsset} onWatch={toggleWatchlist} watchlist={watchlist} /> : null}
        {["Markets", "Stocks", "Crypto", "ETFs", "Indexes"].includes(route) ? (
          <AssetDetail
            asset={selectedAsset}
            assets={filteredAssets.filter((asset) =>
              route === "Markets" ? true : route === "Stocks" ? asset.type === "stock" : route === "Crypto" ? asset.type === "crypto" : route === "ETFs" ? asset.type === "etf" : asset.type === "index"
            )}
            onOpen={openAsset}
            onWatch={toggleWatchlist}
            beginner={beginner}
            advanced={advanced}
            setAdvanced={setAdvanced}
            autoColor={autoColor}
            setAutoColor={setAutoColor}
          />
        ) : null}
        {route === "Options" ? <OptionsPage /> : null}
        {route === "Research Ideas" || route === "Screeners" ? <ResearchAndScreeners onOpen={openAsset} onWatch={toggleWatchlist} /> : null}
        {route === "News" ? <NewsDesk onOpen={openAsset} /> : null}
        {route === "Predictions" ? (
          <PredictionsPage selectedAsset={selectedAsset} scenarioAmount={scenarioAmount} setScenarioAmount={setScenarioAmount} scenario={scenario} />
        ) : null}
        {route === "Compare" ? <ComparePage onOpen={openAsset} /> : null}
        {route === "Watchlists" ? <WatchlistPage watchlist={watchlist} onOpen={openAsset} onWatch={toggleWatchlist} /> : null}
        {route === "Alerts" ? <AlertsPage setToast={setToast} /> : null}
        {route === "Learn" ? <LearnPage terms={glossaryMatches} /> : null}
        {route === "System Status" ? <SystemStatus /> : null}
        {route === "Account" ? <AccountPage beginner={beginner} compact={compact} theme={theme} /> : null}
        {route === "Settings" ? <SettingsPage autoColor={autoColor} setAutoColor={setAutoColor} /> : null}
        {route === "Admin Dashboard" || route === "Backend Jobs" || route === "Data Quality" ? <AdminPage route={route} /> : null}

        <div className="toast" role="status">
          {toast}
        </div>
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {(["Dashboard", "Markets", "Screeners", "Watchlists", "Account"] as RouteLabel[]).map((label) => {
          const Icon = iconMap[label] ?? Home;
          return (
            <button key={label} type="button" className={route === label ? "active" : ""} onClick={() => setRoute(label)}>
              <Icon size={19} />
              <span>{label === "Screeners" ? "Search" : label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function Landing({
  selectedAsset,
  mood,
  onRoute,
  onOpen,
  onWatch,
  beginner
}: {
  selectedAsset: Asset;
  mood: ReturnType<typeof calculateMarketMood>;
  onRoute: (route: RouteLabel) => void;
  onOpen: (symbol: string) => void;
  onWatch: (symbol: string) => void;
  beginner: boolean;
}) {
  return (
    <section className="page landing">
      <div className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Market research command center</span>
          <h1>{appConfig.heroHeadline}</h1>
          <p>{appConfig.heroSubheadline}</p>
          <div className="button-row">
            <button className="primary-button" type="button" onClick={() => onRoute("Dashboard")}>
              Explore market
            </button>
            <button className="ghost-button" type="button" onClick={() => onRoute("Screeners")}>
              Open scanner
            </button>
            <button className="ghost-button" type="button" onClick={() => onRoute("News")}>
              News impact desk
            </button>
            <button className="ghost-button" type="button" onClick={() => onRoute("Account")}>
              Create free account
            </button>
          </div>
          {beginner ? <p className="beginner-note">Beginner Mode: a signal is a research label, not advice or an instruction.</p> : null}
        </div>
        <div className="hero-visual">
          <div className="row-between">
            <span className="eyebrow">Signal of the day</span>
            <Badge tone={signalClass(selectedAsset.signal)}>{selectedAsset.signal}</Badge>
          </div>
          <h2>{selectedAsset.symbol}</h2>
          <strong className="hero-price">{currency(selectedAsset.price)}</strong>
          <div className="terminal-strip">
            <span>Confidence {selectedAsset.confidence}</span>
            <span>Risk {selectedAsset.risk}</span>
            <span>Data {selectedAsset.meta.dataStatus}</span>
          </div>
          <MarketChart asset={selectedAsset} advanced={false} autoColor />
        </div>
      </div>

      <div className="grid">
        <section className="panel span-4">
          <div className="panel-head">
            <div>
              <h2>Overall Market Mood</h2>
              <p>Calculated from demo breadth, momentum, risk, and participation.</p>
            </div>
            <Badge tone="warning">Demo Mode</Badge>
          </div>
          <div className="gauge" style={{ "--score": mood.score } as React.CSSProperties}>
            <span>{mood.score}</span>
          </div>
          <div className="row-between">
            <Stat label="Mood" value={mood.label} />
            <Stat label="Breadth" value={`${mood.breadth}%`} />
          </div>
        </section>
        <section className="panel span-8">
          <div className="panel-head">
            <div>
              <h2>Major Index and Crypto Movement</h2>
              <p>Polished market list with provider state on every row.</p>
            </div>
            <Badge tone="warning">Demo Mode</Badge>
          </div>
          <div className="asset-list compact-list">
            {demoAssets.filter((asset) => ["etf", "index", "crypto"].includes(asset.type)).map((asset) => (
              <AssetRow key={asset.symbol} asset={asset} onOpen={onOpen} onWatch={onWatch} />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function Dashboard({
  mood,
  onOpen,
  onWatch,
  watchlist
}: {
  mood: ReturnType<typeof calculateMarketMood>;
  onOpen: (symbol: string) => void;
  onWatch: (symbol: string) => void;
  watchlist: string[];
}) {
  const movers = [...demoAssets].sort((a, b) => b.changePercent - a.changePercent);
  return (
    <section className="page">
      <PageTitle eyebrow="Dashboard" title="Market home screen" copy="A calm overview of indexes, watchlist assets, movers, news, and research signals." />
      <div className="dashboard-grid">
        <section className="feature-panel">
          <div className="panel-head">
            <div>
              <h2>Market Mood</h2>
              <p>{mood.label} · {mood.breadth}% breadth · average move {percent(mood.averageChange)}</p>
            </div>
            <Gauge />
          </div>
          <div className="mood-meter">
            <div style={{ width: `${mood.score}%` }} />
          </div>
        </section>
        <section className="panel">
          <h2>Signal of the Day</h2>
          <AssetRow asset={demoAssets[0]} onOpen={onOpen} onWatch={onWatch} />
        </section>
        <section className="panel">
          <h2>Your Watchlist</h2>
          <div className="asset-list">
            {demoAssets.filter((asset) => watchlist.includes(asset.symbol)).map((asset) => (
              <AssetRow key={asset.symbol} asset={asset} onOpen={onOpen} onWatch={onWatch} />
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>Movers</h2>
          <div className="split-list">
            <div>
              <h3 className="positive">Gainers</h3>
              {movers.slice(0, 4).map((asset) => (
                <AssetRow key={asset.symbol} asset={asset} onOpen={onOpen} onWatch={onWatch} />
              ))}
            </div>
            <div>
              <h3 className="negative">Losers</h3>
              {[...movers].reverse().slice(0, 4).map((asset) => (
                <AssetRow key={asset.symbol} asset={asset} onOpen={onOpen} onWatch={onWatch} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

function AssetDetail({
  asset,
  assets,
  onOpen,
  onWatch,
  beginner,
  advanced,
  setAdvanced,
  autoColor,
  setAutoColor
}: {
  asset: Asset;
  assets: Asset[];
  onOpen: (symbol: string) => void;
  onWatch: (symbol: string) => void;
  beginner: boolean;
  advanced: boolean;
  setAdvanced: (value: boolean) => void;
  autoColor: boolean;
  setAutoColor: (value: boolean) => void;
}) {
  return (
    <section className="page">
      <div className="asset-header">
        <div className="asset-title">
          <span className="asset-logo large">{asset.symbol.slice(0, 2).replace("^", "I")}</span>
          <div>
            <span className="eyebrow">{asset.exchange} · {asset.type.toUpperCase()}</span>
            <h1>{asset.name}</h1>
            <p>{asset.symbol} · {asset.sector}</p>
          </div>
        </div>
        <div className="asset-actions">
          <button className="ghost-button" type="button" onClick={() => onWatch(asset.symbol)}>Watchlist</button>
          <button className="ghost-button" type="button" onClick={() => setAdvanced(!advanced)}>{advanced ? "Simple chart" : "Advanced chart"}</button>
          <button className="ghost-button" type="button" onClick={() => setAutoColor(!autoColor)}>Auto color {autoColor ? "On" : "Off"}</button>
          <DataPill asset={asset} />
        </div>
      </div>
      <div className="price-band">
        <div>
          <strong>{currency(asset.price, asset.price > 1000 ? 2 : 2)}</strong>
          <span className={asset.changePercent >= 0 ? "positive" : "negative"}>
            {asset.change >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            {currency(asset.change)} · {percent(asset.changePercent)}
          </span>
        </div>
        <p>{explainStatus(asset.meta)}</p>
      </div>
      <MarketChart asset={asset} advanced={advanced} autoColor={autoColor} />
      {beginner ? (
        <div className="beginner-note">
          Beginner Mode: {asset.signal} means this asset may be worth tracking or avoiding based on current research signals. It is not advice.
        </div>
      ) : null}
      <div className="grid">
        <section className="panel span-8">
          <h2>Key Statistics</h2>
          <div className="stat-grid">
            <Stat label="Open" value={currency(asset.open)} />
            <Stat label="Previous close" value={currency(asset.previousClose)} />
            <Stat label="Day high" value={currency(asset.dayHigh)} />
            <Stat label="Day low" value={currency(asset.dayLow)} />
            <Stat label="52-week high" value={currency(asset.yearHigh)} />
            <Stat label="52-week low" value={currency(asset.yearLow)} />
            <Stat label="Volume" value={asset.volume ? compactNumber(asset.volume) : "Not available"} note={asset.volume ? undefined : "Indexes may not expose volume."} />
            <Stat label="Relative volume" value={asset.relativeVolume || "Not available"} />
            <Stat label="Market cap" value={asset.marketCap ? compactNumber(asset.marketCap) : "Not available"} />
            <Stat label="P/E ratio" value={asset.peRatio ?? "Not available"} />
            <Stat label="Bid / Ask" value={asset.bid && asset.ask ? `${currency(asset.bid)} / ${currency(asset.ask)}` : "Not available"} />
            <Stat label="Volatility" value={`${asset.volatility}/100`} />
          </div>
        </section>
        <section className="panel span-4">
          <h2>Research Signal</h2>
          <Badge tone={signalClass(asset.signal)}>{asset.signal}</Badge>
          <p>{asset.explanation}</p>
          <div className="score-stack">
            <Meter label="Confidence" value={asset.confidence} />
            <Meter label="Risk" value={asset.risk} danger />
            <Meter label="Sentiment" value={Math.round((asset.sentiment + 1) * 50)} />
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Available Market List</h2>
            <p>Search results use stored data first. Unsupported refreshes are queued when Supabase is configured.</p>
          </div>
        </div>
        <div className="asset-list">
          {assets.map((item) => (
            <AssetRow key={item.symbol} asset={item} onOpen={onOpen} onWatch={onWatch} />
          ))}
        </div>
      </section>
    </section>
  );
}

function ResearchAndScreeners({ onOpen, onWatch }: { onOpen: (symbol: string) => void; onWatch: (symbol: string) => void }) {
  const best = [...demoAssets].sort((a, b) => b.confidence - b.risk - (a.confidence - a.risk)).slice(0, 5);
  const risky = [...demoAssets].sort((a, b) => b.risk + b.hype - (a.risk + a.hype)).slice(0, 5);
  return (
    <section className="page">
      <PageTitle eyebrow="Scanner" title="Market command deck" copy="Older scanner concepts rebuilt in the upgraded V3 design." />
      <div className="grid">
        <ScannerCard title="Should I Watch This?" icon={<Target />} copy="Enter a symbol in global search to open an evidence-backed Watch, Wait, Avoid, or Research further read." />
        <ScannerCard title="Heat Map Wall" icon={<Activity />} copy="Ranks assets by sector, percent move, confidence, risk, and participation." />
        <ScannerCard title="Whale Radar" icon={<Zap />} copy="Flags high relative volume and unusual participation without inventing private order-flow data." />
        <ScannerCard title="Hype vs Risk" icon={<AlertTriangle />} copy="Compares crowd interest with downside uncertainty so high-attention assets stay honest." />
        <ScannerCard title="Red Flag Detector" icon={<ShieldCheck />} copy="Shows stale data, weak trend alignment, high volatility, wide spreads, and negative news tone." />
        <ScannerCard title="Prediction Battle Cards" icon={<Sparkles />} copy="Compares two research ideas by confidence, risk, safety, and uncertainty." />
      </div>
      <section className="panel">
        <h2>Best Setups Right Now</h2>
        <div className="asset-list">
          {best.map((asset) => (
            <AssetRow key={asset.symbol} asset={asset} onOpen={onOpen} onWatch={onWatch} />
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Research Queue</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Asset</th>
                <th>Setup</th>
                <th>Total</th>
                <th>News</th>
                <th>Risk</th>
                <th>Why</th>
                <th>Invalid if</th>
              </tr>
            </thead>
            <tbody>
              {risky.map((asset, index) => (
                <tr key={asset.symbol}>
                  <td>{index + 1}</td>
                  <td>{asset.symbol}</td>
                  <td>{asset.signal}</td>
                  <td>{asset.confidence - asset.risk}</td>
                  <td>{asset.news[0]?.tone ?? "Neutral"}</td>
                  <td>{asset.risk}</td>
                  <td>{asset.explanation}</td>
                  <td>Close below {currency(asset.support)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function NewsDesk({ onOpen }: { onOpen: (symbol: string) => void }) {
  return (
    <section className="page">
      <PageTitle eyebrow="News Impact Desk" title="Headlines the scanner is watching" copy="News is stored with source, timestamp, related assets, tone, and impact. Demo headlines are clearly labeled." />
      <div className="grid">
        <section className="panel span-4">
          <h2>Impact Leaders</h2>
          {demoNews.map((item) => (
            <div className="news-mini" key={item.id}>
              <strong>{item.relatedSymbols.join(", ")}</strong>
              <span>{item.impactScore}/100 · {item.tone}</span>
            </div>
          ))}
        </section>
        <section className="panel span-8">
          <h2>Headlines</h2>
          <div className="news-list">
            {demoNews.map((item) => (
              <article key={item.id} className="news-card">
                <div>
                  <Badge tone={item.tone === "Positive" ? "positive" : item.tone === "Negative" ? "negative" : "warning"}>{item.tone}</Badge>
                  <h3>{item.headline}</h3>
                  <p>{item.summary}</p>
                  <small>{item.source} · {formatDateTime(item.publishedAt)}</small>
                </div>
                <div className="button-row">
                  {item.relatedSymbols.map((symbol) => (
                    <button className="small-button" key={symbol} type="button" onClick={() => onOpen(symbol)}>
                      {symbol}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
      <section className="panel">
        <h2>News Impact Table</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Impact</th>
                <th>News tone</th>
                <th>Confidence</th>
                <th>Price move</th>
                <th>Prediction</th>
                <th>Headline</th>
              </tr>
            </thead>
            <tbody>
              {demoAssets.slice(0, 8).map((asset) => (
                <tr key={asset.symbol}>
                  <td>{asset.symbol}</td>
                  <td>{asset.news[0]?.impactScore ?? 42}</td>
                  <td>{asset.news[0]?.tone ?? "Neutral"}</td>
                  <td>{asset.confidence}</td>
                  <td className={asset.changePercent >= 0 ? "positive" : "negative"}>{percent(asset.changePercent)}</td>
                  <td>{asset.prediction.label}</td>
                  <td>{asset.news[0]?.headline ?? "No recent demo headline attached."}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function PredictionsPage({
  selectedAsset,
  scenarioAmount,
  setScenarioAmount,
  scenario
}: {
  selectedAsset: Asset;
  scenarioAmount: number;
  setScenarioAmount: (value: number) => void;
  scenario: { possibleGain: number; possibleLoss: number };
}) {
  return (
    <section className="page">
      <PageTitle eyebrow="Predictions" title="Accountable market predictions" copy="Predictions are immutable research estimates with uncertainty, invalidation, and eventual outcomes." />
      <div className="grid">
        <section className="panel span-5">
          <h2>Safety Score</h2>
          <div className="gauge safety" style={{ "--score": selectedAsset.prediction.safety } as React.CSSProperties}>
            <span>{selectedAsset.prediction.safety}</span>
          </div>
          <p>{selectedAsset.prediction.uncertainty}</p>
        </section>
        <section className="panel span-7">
          <h2>Run a Scenario</h2>
          <p>Possible gain and loss amounts are scenario estimates, not recommendations.</p>
          <label className="field">
            Amount to model
            <input type="number" min="1" value={scenarioAmount} onChange={(event) => setScenarioAmount(Number(event.target.value))} />
          </label>
          <div className="stat-grid">
            <Stat label="Possible gain scenario" value={currency(scenario.possibleGain)} />
            <Stat label="Possible loss scenario" value={currency(scenario.possibleLoss)} />
            <Stat label="Horizon" value={selectedAsset.prediction.horizon} />
            <Stat label="Outcome status" value={selectedAsset.prediction.outcome} />
          </div>
        </section>
      </div>
      <section className="panel">
        <h2>Top Prediction Ideas</h2>
        <div className="prediction-grid">
          {demoAssets.slice(0, 6).map((asset) => (
            <article className="prediction-card" key={asset.symbol}>
              <div className="row-between">
                <strong>{asset.symbol}</strong>
                <Badge tone={signalClass(asset.prediction.label)}>{asset.prediction.label}</Badge>
              </div>
              <p>{asset.prediction.thesis[0]}</p>
              <Meter label="Confidence" value={asset.prediction.confidence} />
              <Meter label="Risk" value={asset.prediction.risk} danger />
              <small>{asset.prediction.invalidation}</small>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function OptionsPage() {
  return (
    <section className="page">
      <PageTitle eyebrow="Options" title="Options research only" copy="No option prices or Greeks are estimated. Provider-backed data appears only after secure ingestion is configured." />
      <section className="panel unavailable">
        <AlertTriangle />
        <h2>{optionResearchState.title}</h2>
        <p>{optionResearchState.copy}</p>
        <div className="tag-cloud">
          {optionResearchState.fields.map((field) => (
            <span key={field}>{field}</span>
          ))}
        </div>
      </section>
    </section>
  );
}

function ComparePage({ onOpen }: { onOpen: (symbol: string) => void }) {
  const candidates = demoAssets.slice(0, 4);
  return (
    <section className="page">
      <PageTitle eyebrow="Compare" title="Prediction battle cards" copy="Compare confidence, risk, trend, news impact, and scenario ranges without directive trading language." />
      <div className="prediction-grid">
        {candidates.map((asset) => (
          <article className="prediction-card" key={asset.symbol}>
            <div className="row-between">
              <strong>{asset.symbol}</strong>
              <button className="small-button" type="button" onClick={() => onOpen(asset.symbol)}>Open</button>
            </div>
            <Stat label="Price" value={currency(asset.price)} />
            <Meter label="Confidence" value={asset.confidence} />
            <Meter label="Risk" value={asset.risk} danger />
            <p>{asset.explanation}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function WatchlistPage({ watchlist, onOpen, onWatch }: { watchlist: string[]; onOpen: (symbol: string) => void; onWatch: (symbol: string) => void }) {
  const assets = demoAssets.filter((asset) => watchlist.includes(asset.symbol));
  return (
    <section className="page">
      <PageTitle eyebrow="Watchlists" title="Research watchlist" copy="Watchlists are local in Demo Mode and persist through Supabase after authentication is configured." />
      <section className="panel">
        {assets.length ? (
          <div className="asset-list">
            {assets.map((asset) => (
              <AssetRow key={asset.symbol} asset={asset} onOpen={onOpen} onWatch={onWatch} />
            ))}
          </div>
        ) : (
          <EmptyState title="No watchlist assets yet." copy="Add assets from dashboard rows or market pages." />
        )}
      </section>
    </section>
  );
}

function AlertsPage({ setToast }: { setToast: (value: string) => void }) {
  return (
    <section className="page">
      <PageTitle eyebrow="Alerts" title="Research alerts" copy="Alerts can be stored for price changes, risk changes, confidence changes, signal changes, stale data, and provider errors." />
      <section className="panel">
        <div className="alert-grid">
          {["Price moved", "Risk changed", "Confidence changed", "Signal changed", "News sentiment changed", "Data became stale"].map((label) => (
            <button key={label} className="alert-rule" type="button" onClick={() => setToast(`${label} alert saved locally. Supabase persistence activates after auth setup.`)}>
              <Bell />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}

function LearnPage({ terms }: { terms: typeof glossaryTerms }) {
  return (
    <section className="page">
      <PageTitle eyebrow="Learn" title="Searchable glossary" copy="Beginner-friendly definitions use the same underlying market concepts as Advanced Mode." />
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

function SystemStatus() {
  return (
    <section className="page">
      <PageTitle eyebrow="System Status" title="Data provider and workflow health" copy="Provider keys are checked only in secure backend workflows. Key values are never displayed." />
      <div className="grid">
        {providerHealth.map((item) => (
          <section className="panel span-4" key={item.provider}>
            <h2>{item.provider}</h2>
            <Badge tone={item.marketData === "Healthy" ? "positive" : "warning"}>Market {item.marketData}</Badge>
            <Badge tone={item.newsData === "Healthy" ? "positive" : "warning"}>News {item.newsData}</Badge>
            <p>{item.notes}</p>
            <small>Last run: {formatDateTime(item.lastRun)}</small>
          </section>
        ))}
      </div>
    </section>
  );
}

function AccountPage({ beginner, compact, theme }: { beginner: boolean; compact: boolean; theme: string }) {
  return (
    <section className="page">
      <PageTitle eyebrow="Account" title="Free research account" copy={hasSupabaseConfig ? "Supabase Auth is configured." : "Supabase Auth is not configured locally, so account forms are disabled with a clear reason."} />
      <section className="panel">
        <div className="auth-grid">
          <label className="field">Email<input disabled placeholder="Connect Supabase to enable email signup" /></label>
          <label className="field">Password<input disabled type="password" placeholder="Disabled in Demo Mode" /></label>
          <button className="primary-button" disabled type="button">Supabase setup required</button>
        </div>
        <p>{appConfig.minAgeCopy}</p>
        <div className="stat-grid">
          <Stat label="Role" value="Guest" />
          <Stat label="Beginner preference" value={beginner ? "On" : "Off"} />
          <Stat label="Compact preference" value={compact ? "On" : "Off"} />
          <Stat label="Theme" value={theme} />
        </div>
      </section>
    </section>
  );
}

function SettingsPage({ autoColor, setAutoColor }: { autoColor: boolean; setAutoColor: (value: boolean) => void }) {
  return (
    <section className="page">
      <PageTitle eyebrow="Settings" title="Research preferences" copy="Preferences are local in Demo Mode and move to user_settings after Supabase Auth is configured." />
      <section className="panel">
        <label className="toggle big">
          <input type="checkbox" checked={autoColor} onChange={(event) => setAutoColor(event.target.checked)} />
          Automatic chart color changes
        </label>
        <EmptyState title="Notification preferences need an account." copy="Create a Supabase-backed account to save watchlists, alerts, default interval, time zone, and display settings." />
      </section>
    </section>
  );
}

function AdminPage({ route }: { route: RouteLabel }) {
  const stats = [
    ["Total users", "Demo unavailable"],
    ["Most searched stocks", "MSFT, NVDA, AAPL"],
    ["API error count", "0 demo errors"],
    ["Historical coverage", "Fixture range only"],
    ["Prediction accuracy", "Pending outcomes"],
    ["Discord webhook", "Secret required"]
  ];
  return (
    <section className="page">
      <PageTitle eyebrow="Admin Control Room" title={route} copy="Protected by Supabase role policies in production. Demo view exposes no private keys or private user data." />
      <div className="stat-grid admin-stats">
        {stats.map(([label, value]) => (
          <Stat key={label} label={label} value={value} />
        ))}
      </div>
      <section className="panel">
        <h2>Backend Log</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Workflow</th>
                <th>Status</th>
                <th>Last run</th>
                <th>Safe action</th>
              </tr>
            </thead>
            <tbody>
              {["market-ingestion", "historical-backfill", "prediction-jobs", "daily-summary", "data-quality"].map((job) => (
                <tr key={job}>
                  <td>{job}</td>
                  <td>Ready for GitHub Actions</td>
                  <td>{formatDateTime("2026-06-15T14:36:03-04:00")}</td>
                  <td>Run manually from Actions tab</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
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

function ScannerCard({ title, icon, copy }: { title: string; icon: React.ReactNode; copy: string }) {
  return (
    <article className="scanner-card">
      <div className="scanner-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{copy}</p>
    </article>
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

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="empty-state">
      <Sparkles />
      <h2>{title}</h2>
      <p>{copy}</p>
    </div>
  );
}
