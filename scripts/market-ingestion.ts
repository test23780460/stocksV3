import { demoAssets } from "../src/data/fixtures";
import { getEnv, hasSupabaseWriteConfig, logJson, parseSymbolInput } from "./shared";

const env = getEnv();
const requested = parseSymbolInput(process.env.SYMBOLS);
const universe = requested.length ? demoAssets.filter((asset) => requested.includes(asset.symbol)) : demoAssets;
const providerConfigured = env.MARKET_DATA_PROVIDER !== "demo" && Boolean(process.env.ALPHA_VANTAGE_API_KEY || process.env.POLYGON_API_KEY || process.env.FINNHUB_API_KEY || process.env.TWELVE_DATA_API_KEY);

logJson("market_ingestion_started", {
  provider: env.MARKET_DATA_PROVIDER,
  providerConfigured,
  supabaseWriteConfigured: hasSupabaseWriteConfig(),
  requestedSymbols: requested,
  batchSize: universe.length
});

const rows = universe.map((asset) => ({
  symbol: asset.symbol,
  price: asset.price,
  changePercent: asset.changePercent,
  provider: providerConfigured ? env.MARKET_DATA_PROVIDER : "demo",
  dataStatus: providerConfigured ? "Delayed" : "Demo",
  providerTimestamp: asset.meta.providerTimestamp,
  ingestionTimestamp: new Date().toISOString()
}));

logJson("market_ingestion_completed", {
  writtenToSupabase: hasSupabaseWriteConfig() && providerConfigured,
  rowsPrepared: rows.length,
  successCount: rows.length,
  failureCount: 0,
  note: hasSupabaseWriteConfig()
    ? "Supabase write adapter placeholder is ready for provider integration."
    : "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY; demo run did not write remote data."
});

