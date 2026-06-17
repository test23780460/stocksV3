import { NextResponse } from "next/server";
import { getRuntimeStatus } from "../../../services/providerRegistry";
import { runSupabaseIngestion } from "../../../services/ingestion";

export const dynamic = "force-dynamic";

const authorize = (request: Request) => {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${expectedSecret}`;
};

const runIngest = async (request: Request) => {
  if (!authorize(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const status = getRuntimeStatus();
  const result = await runSupabaseIngestion();
  const payload = {
    event: "market_ingest_checked",
    at: new Date().toISOString(),
    mode: status.demoMode ? "demo" : "provider-ready",
    wroteRemoteData: result.wroteRemoteData,
    runId: result.runId,
    recordsWritten: {
      assets: result.assetsUpserted,
      quotes: result.quotesUpserted,
      candles: result.candlesUpserted,
      providerStatus: result.providerStatusUpserted
    },
    failures: result.failures,
    message: result.wroteRemoteData
      ? `Supabase ingestion completed with ${result.assetsUpserted} assets, ${result.quotesUpserted} quotes, and ${result.candlesUpserted} candles written.`
      : status.supabaseServerConfigured
        ? "Ingestion ran but no remote records were written. Check provider and Supabase job failures."
        : "Vercel cron reached the ingestion route. Supabase service credentials are missing, so no remote records were written.",
    status
  };

  console.log(
    JSON.stringify({
      event: payload.event,
      at: payload.at,
      mode: payload.mode,
      providerCount: status.providers.filter((provider) => provider.configured).length,
      supabaseServerConfigured: status.supabaseServerConfigured,
      recordsWritten: payload.recordsWritten,
      failureCount: result.failures.length
    })
  );

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
};

export async function GET(request: Request) {
  return runIngest(request);
}

export async function POST(request: Request) {
  return runIngest(request);
}
