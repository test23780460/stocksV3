import { NextResponse } from "next/server";
import { getRuntimeStatus } from "../../../services/providerRegistry";
import { getNews } from "../../../services/marketData";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol")?.toUpperCase();
  const query = url.searchParams.get("q")?.toLowerCase();
  const payload = await getNews(symbol, query);

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
