export type RouteId =
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

export interface AppRouteState {
  route: RouteId;
  selectedSymbol?: string;
  invalid?: boolean;
}

const symbolPattern = /^[A-Z0-9.^-]{1,16}$/;

const normalizePathSymbol = (symbol: string) => decodeURIComponent(symbol).trim().toUpperCase();

const cryptoPathSymbol = (symbol: string) => {
  const upper = normalizePathSymbol(symbol);
  if (upper === "BTC" || upper === "BTCUSD") return "BTC-USD";
  if (upper === "ETH" || upper === "ETHUSD") return "ETH-USD";
  if (upper === "SOL" || upper === "SOLUSD") return "SOL-USD";
  return upper;
};

export const routePath: Record<RouteId, string> = {
  dashboard: "/dashboard",
  stocks: "/markets/stocks",
  crypto: "/markets/crypto",
  etfs: "/markets/etfs",
  indexes: "/markets/indexes",
  news: "/news",
  screener: "/screener",
  predictions: "/predictions",
  compare: "/compare",
  ideas: "/research-ideas",
  watchlists: "/watchlists",
  alerts: "/alerts",
  learn: "/learn",
  definitions: "/definitions",
  profile: "/profile",
  settings: "/settings",
  status: "/status",
  admin: "/admin",
  backend: "/admin/jobs",
  quality: "/admin/data-quality",
  "api-usage": "/admin/api-usage",
  audit: "/admin/audit"
};

export const routeTitles: Record<RouteId, string> = {
  dashboard: "Dashboard",
  stocks: "Stocks",
  crypto: "Crypto",
  etfs: "ETFs",
  indexes: "Indexes",
  news: "Market News",
  screener: "Screener",
  predictions: "Predictions",
  compare: "Compare Assets",
  ideas: "Research Ideas",
  watchlists: "Watchlists",
  alerts: "Alerts",
  learn: "Learn",
  definitions: "Definitions",
  profile: "Profile",
  settings: "Settings",
  status: "System Status",
  admin: "Admin",
  backend: "Admin Jobs",
  quality: "Data Quality",
  "api-usage": "API Usage",
  audit: "Audit Logs"
};

export const pathForAsset = (type: string, symbol: string) => {
  const normalized = normalizePathSymbol(symbol);
  if (type === "crypto") return `/crypto/${encodeURIComponent(normalized)}`;
  return `/stocks/${encodeURIComponent(normalized)}`;
};

export const pathForRoute = (route: RouteId, symbol?: string, type?: string) => {
  if (symbol) return pathForAsset(type || (route === "crypto" ? "crypto" : "stock"), symbol);
  return routePath[route] || "/dashboard";
};

export const parseRoutePath = (pathname: string): AppRouteState => {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { route: "dashboard" };
  const segments = path.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  const [first, second] = segments;

  if (first === "dashboard") return { route: "dashboard" };
  if (first === "markets") {
    if (second === "stocks") return { route: "stocks" };
    if (second === "crypto") return { route: "crypto" };
    if (second === "etfs") return { route: "etfs" };
    if (second === "indexes") return { route: "indexes" };
    return { route: "dashboard", invalid: true };
  }
  if (first === "stocks" && second) {
    const symbol = normalizePathSymbol(second);
    return symbolPattern.test(symbol) ? { route: "stocks", selectedSymbol: symbol } : { route: "stocks", invalid: true };
  }
  if (first === "crypto" && second) {
    const symbol = cryptoPathSymbol(second);
    return symbolPattern.test(symbol) ? { route: "crypto", selectedSymbol: symbol } : { route: "crypto", invalid: true };
  }
  if (first === "news") return { route: "news" };
  if (first === "screener") return { route: "screener" };
  if (first === "predictions") return { route: "predictions" };
  if (first === "compare") return { route: "compare" };
  if (first === "research-ideas") return { route: "ideas" };
  if (first === "watchlists") return { route: "watchlists" };
  if (first === "alerts") return { route: "alerts" };
  if (first === "learn") return { route: "learn" };
  if (first === "definitions") return { route: "definitions" };
  if (first === "profile") return { route: "profile" };
  if (first === "settings") return { route: "settings" };
  if (first === "status") return { route: "status" };
  if (first === "admin") {
    if (!second) return { route: "admin" };
    if (second === "jobs") return { route: "backend" };
    if (second === "data-quality") return { route: "quality" };
    if (second === "api-usage") return { route: "api-usage" };
    if (second === "audit") return { route: "audit" };
    return { route: "admin", invalid: true };
  }

  return { route: "dashboard", invalid: true };
};
