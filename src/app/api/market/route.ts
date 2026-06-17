import { NextResponse } from "next/server";
import { getMarketSnapshot } from "../../../services/marketData";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getMarketSnapshot(), {
    headers: {
      "Cache-Control": "s-maxage=60, stale-while-revalidate=300"
    }
  });
}
