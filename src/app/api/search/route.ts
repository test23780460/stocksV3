import { NextResponse } from "next/server";
import { getSearchResults } from "../../../services/marketData";
import { parseOrBadRequest, safeQuerySchema } from "../../../services/apiValidation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = parseOrBadRequest(safeQuerySchema, url.searchParams.get("q") ?? "");
  if (query.error) return NextResponse.json(query.error, { status: 400 });
  const results = await getSearchResults(query.data ?? "");

  return NextResponse.json(results, {
    headers: {
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400"
    }
  });
}
