import { demoAssets } from "../src/data/fixtures";
import { hasSupabaseWriteConfig, logJson, parseSymbolInput } from "./shared";

const requested = parseSymbolInput(process.env.SYMBOLS || process.env.SYMBOL);
const assets = requested.length ? demoAssets.filter((asset) => requested.includes(asset.symbol)) : demoAssets;
const startDate = process.env.START_DATE || "2021-06-15";
const endDate = process.env.END_DATE || "2026-06-15";

logJson("historical_backfill_started", {
  mode: requested.length ? "symbols" : "tracked_universe",
  symbols: assets.map((asset) => asset.symbol),
  startDate,
  endDate,
  supabaseWriteConfigured: hasSupabaseWriteConfig()
});

const rows = assets.reduce((sum, asset) => sum + asset.bars.length, 0);

logJson("historical_backfill_completed", {
  symbolsCompleted: assets.length,
  symbolsRemaining: 0,
  rowsPrepared: rows,
  missingRangesRecorded: assets.length,
  rateLimitStatus: "not reached in demo provider",
  writtenToSupabase: false,
  note: "Demo backfill prepares deterministic fixture bars. Live provider storage requires service-role Supabase configuration."
});

