import { NextResponse } from "next/server";
import { getStoredQuote } from "../../../../services/collectorData";
import { parseOrBadRequest, safeQuerySchema } from "../../../../services/apiValidation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbolsInput = parseOrBadRequest(safeQuerySchema, url.searchParams.get("symbols") ?? "");
  if (symbolsInput.error) return NextResponse.json(symbolsInput.error, { status: 400 });
  const symbols = String(symbolsInput.data ?? "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => /^[A-Z0-9.^-]{1,12}$/.test(symbol))
    .slice(0, 100);
  const quotes = (await Promise.all(symbols.map((symbol) => getStoredQuote(symbol)))).filter(Boolean);
  return NextResponse.json({ quotes, generatedAt: new Date().toISOString(), mode: quotes.length ? "collector" : "unavailable" }, { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=120" } });
}
