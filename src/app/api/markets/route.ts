import { NextResponse } from "next/server";
import { getMarketSnapshot } from "../../../services/marketData";
import { booleanStringSchema, parseOrBadRequest } from "../../../services/apiValidation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const refresh = parseOrBadRequest(booleanStringSchema, url.searchParams.get("refresh") ?? undefined);
  if (refresh.error) return NextResponse.json(refresh.error, { status: 400 });
  const snapshot = await getMarketSnapshot({ refresh: Boolean(refresh.data) });

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": refresh ? "no-store" : "s-maxage=60, stale-while-revalidate=300"
    }
  });
}
