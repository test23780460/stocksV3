import { NextResponse } from "next/server";
import { getMarketSnapshot, getRuntimeStatus } from "../../../services/marketData";

export const dynamic = "force-dynamic";

export async function POST() {
  const status = getRuntimeStatus();
  const snapshot = await getMarketSnapshot({ refresh: true });
  const lastUpdated = new Date().toISOString();
  const liveCount = snapshot.assets.filter((asset) => asset.meta.dataStatus === "Live" || asset.meta.dataStatus === "Delayed").length;

  return NextResponse.json(
    {
      status: liveCount ? "fresh" : "demo-fallback",
      lastUpdated,
      message: liveCount
        ? `Refresh completed through internal API routes. ${liveCount}/${snapshot.assets.length} assets used provider-backed or delayed data.`
        : "Refresh completed with Demo fallback because stock provider keys are missing or unavailable.",
      providerStatus: status.providers,
      cache: snapshot.cache,
      market: snapshot,
      dataStatusCounts: snapshot.assets.reduce<Record<string, number>>((counts, asset) => {
        counts[asset.meta.dataStatus] = (counts[asset.meta.dataStatus] ?? 0) + 1;
        return counts;
      }, {})
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
