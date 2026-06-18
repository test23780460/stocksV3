import { NextResponse } from "next/server";
import { getStoredSearchResults } from "../../../services/collectorData";
import { directProviderFallbackEnabled, getSearchResults } from "../../../services/marketData";
import { parseOrBadRequest, safeQuerySchema } from "../../../services/apiValidation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = parseOrBadRequest(safeQuerySchema, url.searchParams.get("q") ?? "");
  if (query.error) return NextResponse.json(query.error, { status: 400 });
  const stored = await getStoredSearchResults(query.data ?? "");
  const results = stored ?? (await getSearchResults(query.data ?? "", { directProviders: directProviderFallbackEnabled() }));

  return NextResponse.json(results, {
    headers: {
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400"
    }
  });
}
