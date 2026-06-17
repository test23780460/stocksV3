import { NextResponse } from "next/server";
import { getStockHistory, notFoundResponse, serverErrorResponse } from "../../../services/marketData";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol")?.trim();
  const range = url.searchParams.get("range") || "1Y";
  const interval = url.searchParams.get("interval") || "1D";
  const refresh = url.searchParams.get("refresh") === "true";

  if (!symbol) {
    return NextResponse.json({ error: "bad_request", message: "Missing required symbol query parameter." }, { status: 400 });
  }

  try {
    const history = await getStockHistory(symbol, range, interval, { refresh });
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
