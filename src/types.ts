export type AssetType = "stock" | "crypto" | "etf" | "index" | "option";
export type SignalLabel = "Watch" | "Wait" | "Avoid" | "Research further";
export type DataStatus =
  | "Live"
  | "Real-time IEX"
  | "Provider-supplied"
  | "Near real-time"
  | "Delayed"
  | "Intraday snapshot"
  | "End-of-day"
  | "Cached"
  | "Demo"
  | "Market closed"
  | "Stale"
  | "Incomplete"
  | "Temporarily unavailable"
  | "Unavailable"
  | "Provider error"
  | "Rate limited";
export type UserRole = "guest" | "free" | "premium" | "admin";

export interface MarketMeta {
  provider: string;
  providerTimestamp: string;
  ingestionTimestamp: string;
  lastUpdated: string;
  timezone: string;
  marketStatus: "Open" | "Closed" | "Pre-market" | "After-hours" | "Continuous";
  dataStatus: DataStatus;
  delayMinutes?: number;
  staleReason?: string;
}

export interface Bar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  publishedAt: string;
  tone: "Positive" | "Neutral" | "Negative" | "Mixed";
  impactScore: number;
  relatedSymbols: string[];
  summary: string;
  url?: string;
  provider?: string;
  dataStatus?: DataStatus;
}

export interface Prediction {
  id: string;
  symbol: string;
  createdAt: string;
  horizon: "1D" | "5D" | "1M" | "3M";
  label: SignalLabel;
  confidence: number;
  risk: number;
  safety: number;
  possibleGainPercent: number;
  possibleLossPercent: number;
  uncertainty: string;
  thesis: string[];
  invalidation: string;
  status: "Open" | "Expired" | "Evaluated";
  outcome?: "Met thesis" | "Missed thesis" | "Mixed" | "Pending";
}

export interface Asset {
  symbol: string;
  name: string;
  type: AssetType;
  exchange: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  yearHigh: number;
  yearLow: number;
  volume: number;
  averageVolume: number;
  relativeVolume: number;
  marketCap?: number;
  peRatio?: number;
  dividendYield?: number;
  bid?: number;
  ask?: number;
  beta?: number;
  volatility: number;
  rsi: number;
  macd: number;
  sma20: number;
  sma50: number;
  sma200: number;
  support: number;
  resistance: number;
  signal: SignalLabel;
  confidence: number;
  risk: number;
  sentiment: number;
  hype: number;
  liquidityWarning?: string;
  optionsWarning?: string;
  meta: MarketMeta;
  bars: Bar[];
  news: NewsItem[];
  prediction: Prediction;
  explanation: string;
}

export interface GlossaryTerm {
  term: string;
  category: string;
  shortDefinition: string;
  fullDefinition: string;
  beginnerExample: string;
  formula?: string;
  related: string[];
}

export interface ProviderHealth {
  provider: string;
  marketData: "Configured" | "Missing" | "Invalid" | "Rate limited" | "Unavailable" | "Disabled" | "Healthy";
  newsData: "Configured" | "Missing" | "Invalid" | "Rate limited" | "Unavailable" | "Disabled" | "Healthy";
  lastRun: string;
  notes: string;
}

export interface ScenarioInput {
  amount: number;
  possibleGainPercent: number;
  possibleLossPercent: number;
}
