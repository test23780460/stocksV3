import { NextResponse } from "next/server";
import { getRuntimeStatusWithCollector, getStoredMarketSnapshot } from "../../../services/collectorData";
import { getMarketSnapshot } from "../../../services/marketData";

export const dynamic = "force-dynamic";

export async function GET() {
  const stored = await getStoredMarketSnapshot();
  const snapshot = stored ?? {
    ...(await getMarketSnapshot()),
    status: await getRuntimeStatusWithCollector()
  };
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "s-maxage=60, stale-while-revalidate=300"
    }
  });
}
