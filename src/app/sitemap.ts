import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://stocks-v111.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    "",
    "dashboard",
    "markets/stocks",
    "markets/crypto",
    "markets/etfs",
    "markets/indexes",
    "stocks/AAPL",
    "crypto/BTC-USD",
    "news",
    "screener",
    "predictions",
    "compare",
    "research-ideas",
    "watchlists",
    "alerts",
    "learn",
    "definitions",
    "profile",
    "settings",
    "status",
    "api/status"
  ];
  return pages.map((path) => ({
    url: `${siteUrl}/${path}`.replace(/\/$/, ""),
    lastModified: new Date("2026-06-15T00:00:00-04:00"),
    changeFrequency: path ? "daily" : "hourly",
    priority: path ? 0.4 : 1
  }));
}
