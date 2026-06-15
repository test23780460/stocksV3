import { demoAssets, demoNews, providerHealth } from "../data/fixtures";

const providers = [
  { name: "Alpha Vantage", env: "ALPHA_VANTAGE_API_KEY", supports: ["quotes", "historical bars"] },
  { name: "Polygon", env: "POLYGON_API_KEY", supports: ["quotes", "historical bars", "news"] },
  { name: "Finnhub", env: "FINNHUB_API_KEY", supports: ["quotes", "news"] },
  { name: "Twelve Data", env: "TWELVE_DATA_API_KEY", supports: ["quotes", "technical indicators"] },
  { name: "CoinGecko", env: "COINGECKO_API_KEY", supports: ["crypto quotes"] },
  { name: "News API", env: "NEWS_API_KEY", supports: ["headlines"] }
];

export const getProviderStatus = () =>
  providers.map((provider) => ({
    name: provider.name,
    configured: Boolean(process.env[provider.env]),
    status: process.env[provider.env] ? "Configured server-side" : "Missing Vercel environment variable",
    supports: provider.supports
  }));

export const getRuntimeStatus = () => {
  const providerStatus = getProviderStatus();
  const liveProviderConfigured = providerStatus.some((provider) => provider.configured);
  return {
    mode: liveProviderConfigured ? "provider-ready" : "demo",
    demoMode: !liveProviderConfigured,
    generatedAt: new Date().toISOString(),
    supabasePublicConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServerConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET),
    providers: providerStatus,
    fixtureCounts: {
      assets: demoAssets.length,
      news: demoNews.length,
      providerHealth: providerHealth.length
    }
  };
};

export const findAsset = (symbol: string) => demoAssets.find((asset) => asset.symbol.toUpperCase() === symbol.toUpperCase());

export const getSafeMarketSnapshot = () => ({
  status: getRuntimeStatus(),
  assets: demoAssets,
  news: demoNews,
  providerHealth
});
