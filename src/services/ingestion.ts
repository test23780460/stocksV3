import type { SupabaseClient } from "@supabase/supabase-js";
import type { Asset } from "../types";
import { getMarketSnapshot, type MarketSnapshotEnvelope } from "./marketData";
import { getSupabaseAdmin, hasSupabaseServerConfig } from "./supabaseServer";

interface IngestionWriteResult {
  wroteRemoteData: boolean;
  assetsRequested: number;
  assetsUpserted: number;
  quotesUpserted: number;
  candlesUpserted: number;
  providerStatusUpserted: number;
  failures: Array<{ symbol: string; error: string }>;
  runId: string | null;
  snapshot: MarketSnapshotEnvelope;
}

const isoForBar = (time: string) => (time.includes("T") ? new Date(time).toISOString() : `${time}T16:00:00.000Z`);

const upsertAsset = async (supabase: SupabaseClient, asset: Asset) => {
  const { data, error } = await supabase
    .from("assets")
    .upsert(
      {
        symbol: asset.symbol,
        name: asset.name,
        asset_type: asset.type,
        exchange: asset.exchange,
        sector: asset.sector,
        provider: asset.meta.provider || "internal",
        is_supported: true,
        metadata: {
          industry: asset.sector,
          demoMetricsPresent: asset.meta.dataStatus === "Demo"
        },
        updated_at: new Date().toISOString()
      },
      { onConflict: "symbol,provider" }
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
};

const writeAssetRows = async (supabase: SupabaseClient, asset: Asset, runId: string | null) => {
  const assetId = await upsertAsset(supabase, asset);
  const providerTimestamp = new Date(asset.meta.providerTimestamp || asset.meta.lastUpdated || Date.now()).toISOString();
  const { error: quoteError } = await supabase.from("market_quotes").upsert(
    {
      asset_id: assetId,
      price: asset.price,
      open: asset.open,
      high: asset.dayHigh,
      low: asset.dayLow,
      previous_close: asset.previousClose,
      change: asset.change,
      change_percent: asset.changePercent,
      volume: asset.volume,
      relative_volume: asset.relativeVolume,
      market_cap: asset.marketCap,
      bid: asset.bid,
      ask: asset.ask,
      provider: asset.meta.provider,
      provider_timestamp: providerTimestamp,
      ingestion_timestamp: new Date().toISOString(),
      data_status: asset.meta.dataStatus,
      market_status: asset.meta.marketStatus,
      provider_metadata: { ingestionRunId: runId }
    },
    { onConflict: "asset_id,provider,provider_timestamp" }
  );
  if (quoteError) throw quoteError;

  const bars = asset.bars.slice(-370).map((bar) => ({
    asset_id: assetId,
    interval: "1D",
    timestamp: isoForBar(bar.time),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    provider: asset.meta.provider,
    data_status: asset.meta.dataStatus,
    provider_metadata: { ingestionRunId: runId }
  }));
  const { error: barsError } = await supabase.from("price_bars").upsert(bars, { onConflict: "asset_id,interval,timestamp,provider" });
  if (barsError) throw barsError;
  return { candles: bars.length };
};

export const runSupabaseIngestion = async (): Promise<IngestionWriteResult> => {
  const snapshot = await getMarketSnapshot({ refresh: true });
  const supabase = getSupabaseAdmin();
  if (!supabase || !hasSupabaseServerConfig()) {
    return {
      wroteRemoteData: false,
      assetsRequested: snapshot.assets.length,
      assetsUpserted: 0,
      quotesUpserted: 0,
      candlesUpserted: 0,
      providerStatusUpserted: 0,
      failures: [],
      runId: null,
      snapshot
    };
  }

  const startedAt = new Date().toISOString();
  const { data: run, error: runError } = await supabase
    .from("data_ingestion_runs")
    .insert({
      provider: snapshot.status.applicationMode,
      status: "running",
      assets_requested: snapshot.assets.length,
      metadata: { mode: snapshot.status.mode, cronSchedule: snapshot.status.cronSchedule }
    })
    .select("id")
    .single();
  if (runError) throw runError;
  const runId = run.id as string;

  let assetsUpserted = 0;
  let quotesUpserted = 0;
  let candlesUpserted = 0;
  const failures: IngestionWriteResult["failures"] = [];

  for (const asset of snapshot.assets) {
    try {
      const result = await writeAssetRows(supabase, asset, runId);
      assetsUpserted += 1;
      quotesUpserted += 1;
      candlesUpserted += result.candles;
    } catch (error) {
      failures.push({ symbol: asset.symbol, error: error instanceof Error ? error.message : "Unknown ingestion failure" });
    }
  }

  const providerRows = snapshot.status.providers.map((provider) => ({
    provider: provider.name,
    market_data_status: provider.configured ? "Configured" : "Missing",
    news_data_status: provider.supports.some((item) => item.includes("news")) ? (provider.configured ? "Configured" : "Missing") : "Disabled",
    last_checked_at: new Date().toISOString(),
    note: provider.status
  }));
  const { error: providerError } = await supabase.from("provider_status").upsert(providerRows, { onConflict: "provider" });
  if (providerError) failures.push({ symbol: "provider_status", error: providerError.message });

  await supabase
    .from("data_ingestion_runs")
    .update({
      finished_at: new Date().toISOString(),
      status: failures.length ? "completed_with_errors" : "completed",
      success_count: assetsUpserted,
      failure_count: failures.length,
      metadata: { startedAt, mode: snapshot.status.mode, failures }
    })
    .eq("id", runId);

  return {
    wroteRemoteData: assetsUpserted > 0,
    assetsRequested: snapshot.assets.length,
    assetsUpserted,
    quotesUpserted,
    candlesUpserted,
    providerStatusUpserted: providerRows.length,
    failures,
    runId,
    snapshot
  };
};
