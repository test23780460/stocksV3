import { NextResponse } from "next/server";
import { getStoredQuote } from "../../../services/collectorData";
import { directProviderFallbackEnabled, getStockQuote, notFoundResponse, serverErrorResponse } from "../../../services/marketData";
import { booleanStringSchema, parseOrBadRequest, symbolSchema } from "../../../services/apiValidation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = parseOrBadRequest(symbolSchema, url.searchParams.get("symbol") ?? "");
  const refresh = parseOrBadRequest(booleanStringSchema, url.searchParams.get("refresh") ?? undefined);

  if (symbol.error) return NextResponse.json(symbol.error, { status: 400 });
  if (refresh.error) return NextResponse.json(refresh.error, { status: 400 });

  try {
    const stored = await getStoredQuote(symbol.data);
    const quote = stored ?? (await getStockQuote(symbol.data, { refresh: Boolean(refresh.data), directProviders: directProviderFallbackEnabled() }));
    return NextResponse.json(quote, {
      headers: {
        "Cache-Control": refresh ? "no-store" : "s-maxage=30, stale-while-revalidate=120"
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("not")) {
      return NextResponse.json(notFoundResponse("Stock symbol was not found."), { status: 404 });
    }
    return NextResponse.json(serverErrorResponse(), { status: 500 });
  }
}
