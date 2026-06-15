import { NextResponse } from "next/server";
import { getSafeMarketSnapshot } from "../../../services/providerRegistry";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getSafeMarketSnapshot(), {
    headers: {
      "Cache-Control": "s-maxage=60, stale-while-revalidate=300"
    }
  });
}
