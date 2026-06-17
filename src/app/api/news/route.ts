import { NextResponse } from "next/server";
import { getRuntimeStatus } from "../../../services/providerRegistry";
import { getNews } from "../../../services/marketData";
import { parseOrBadRequest, safeQuerySchema, symbolSchema } from "../../../services/apiValidation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbolInput = url.searchParams.get("symbol");
  const symbol = symbolInput ? parseOrBadRequest(symbolSchema, symbolInput) : { data: undefined, error: null };
  const query = parseOrBadRequest(safeQuerySchema, url.searchParams.get("q") ?? "");
  if (symbol.error) return NextResponse.json(symbol.error, { status: 400 });
  if (query.error) return NextResponse.json(query.error, { status: 400 });
  const payload = await getNews(symbol.data, (query.data ?? "").toLowerCase());

  return NextResponse.json(
    {
      status: getRuntimeStatus(),
      ...payload
    },
    {
      headers: {
        "Cache-Control": "s-maxage=120, stale-while-revalidate=600"
      }
    }
  );
}
