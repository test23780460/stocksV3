import { NextResponse } from "next/server";
import { getSearchResults } from "../../../services/marketData";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const results = await getSearchResults(query);

  return NextResponse.json(results, {
    headers: {
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400"
    }
  });
}
