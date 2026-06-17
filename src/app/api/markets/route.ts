import { NextResponse } from "next/server";
import { getMarketSnapshot } from "../../../services/marketData";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const refresh = url.searchParams.get("refresh") === "true";
  const snapshot = await getMarketSnapshot({ refresh });

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": refresh ? "no-store" : "s-maxage=60, stale-while-revalidate=300"
    }
  });
}
