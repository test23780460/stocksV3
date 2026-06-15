import type { DataStatus, UserRole } from "./types";

export const appConfig = {
  name: "Market Signal Deck",
  versionLabel: "Stocks V3 Market Signal Deck",
  tagline: "Understand the market before you make your next move.",
  heroHeadline: "AI-powered market research made simple.",
  heroSubheadline:
    "Scan stocks, crypto, ETFs, indexes, options, market trends, news, risk, and predictions in one serious research dashboard.",
  disclaimer:
    "Educational market research only. Nothing on this platform is financial advice. Market predictions are estimates and are not guarantees. Market data may be live, delayed, cached, estimated, incomplete, or unavailable.",
  minAgeCopy:
    "Accounts are intended for ages 13+. Minors should involve a parent or guardian before making financial decisions.",
  roles: ["guest", "free", "premium", "admin"] satisfies UserRole[],
  publicEnv: {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "",
    basePath: ""
  },
  demoStatus: "Demo" as DataStatus
};

export const routeLabels = [
  "Launch",
  "Dashboard",
  "Markets",
  "Stocks",
  "Crypto",
  "ETFs",
  "Indexes",
  "Options",
  "Research Ideas",
  "News",
  "Predictions",
  "Compare",
  "Screeners",
  "Watchlists",
  "Alerts",
  "Learn",
  "System Status",
  "Account",
  "Settings",
  "Admin Dashboard",
  "Backend Jobs",
  "Data Quality"
] as const;

export type RouteLabel = (typeof routeLabels)[number];
