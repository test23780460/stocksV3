import { NextResponse } from "next/server";
import { getStockQuote, notFoundResponse, serverErrorResponse } from "../../../services/marketData";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol")?.trim();
  const refresh = url.searchParams.get("refresh") === "true";

  if (!symbol) {
    return NextResponse.json({ error: "bad_request", message: "Missing required symbol query parameter." }, { status: 400 });
  }

  try {
    const quote = await getStockQuote(symbol, { refresh });
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
