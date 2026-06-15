import { NextResponse } from "next/server";
import { demoNews } from "../../../data/fixtures";
import { getRuntimeStatus } from "../../../services/providerRegistry";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol")?.toUpperCase();
  const query = url.searchParams.get("q")?.toLowerCase();
  const news = demoNews.filter((item) => {
    const symbolMatch = symbol ? item.relatedSymbols.includes(symbol) : true;
    const queryMatch = query
      ? `${item.headline} ${item.summary} ${item.source}`.toLowerCase().includes(query)
      : true;
    return symbolMatch && queryMatch;
  });

  return NextResponse.json(
    {
      status: getRuntimeStatus(),
      news
    },
    {
      headers: {
        "Cache-Control": "s-maxage=120, stale-while-revalidate=600"
      }
    }
  );
}
