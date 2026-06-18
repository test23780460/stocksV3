import { NextResponse } from "next/server";
import { getStoredHistory } from "../../../services/collectorData";
import { directProviderFallbackEnabled, getStockHistory, notFoundResponse, serverErrorResponse } from "../../../services/marketData";
import { booleanStringSchema, intervalSchema, parseOrBadRequest, rangeSchema, symbolSchema } from "../../../services/apiValidation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = parseOrBadRequest(symbolSchema, url.searchParams.get("symbol") ?? "");
  const range = parseOrBadRequest(rangeSchema, url.searchParams.get("range") ?? "1Y");
  const interval = parseOrBadRequest(intervalSchema, url.searchParams.get("interval") ?? "1D");
  const refresh = parseOrBadRequest(booleanStringSchema, url.searchParams.get("refresh") ?? undefined);

  if (symbol.error) return NextResponse.json(symbol.error, { status: 400 });
  if (range.error) return NextResponse.json(range.error, { status: 400 });
  if (interval.error) return NextResponse.json(interval.error, { status: 400 });
  if (refresh.error) return NextResponse.json(refresh.error, { status: 400 });

  try {
    const stored = await getStoredHistory(symbol.data, range.data, interval.data);
    const history = stored ?? (await getStockHistory(symbol.data, range.data, interval.data, { refresh: Boolean(refresh.data), directProviders: directProviderFallbackEnabled() }));
    return NextResponse.json(history, {
      headers: {
        "Cache-Control": refresh ? "no-store" : "s-maxage=300, stale-while-revalidate=1800"
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("not")) {
      return NextResponse.json(notFoundResponse("Historical data was not found for this stock symbol."), { status: 404 });
    }
    return NextResponse.json(serverErrorResponse(), { status: 500 });
  }
}
