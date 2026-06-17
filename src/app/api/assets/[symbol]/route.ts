import { NextResponse } from "next/server";
import { demoAssets } from "../../../../data/fixtures";
import { cryptoIdForSymbol, getCryptoHistory, getCryptoQuote, getRuntimeStatus, getStockHistory, getStockQuote } from "../../../../services/marketData";
import { parseOrBadRequest, symbolSchema } from "../../../../services/apiValidation";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ symbol: string }> }) {
  const params = await context.params;
  const parsed = parseOrBadRequest(symbolSchema, params.symbol);
  if (parsed.error) return NextResponse.json(parsed.error, { status: 400 });
  const symbol = parsed.data;
  const asset = demoAssets.find((item) => item.symbol.toUpperCase() === symbol);

  if (!asset) {
    return NextResponse.json(
      {
        error: "asset_not_found",
        message: "This symbol is not available in the current Demo Mode fixture set.",
        symbol,
        status: getRuntimeStatus()
      },
      { status: 404 }
    );
  }

  const cryptoId = cryptoIdForSymbol(asset.symbol);
  const quote = asset.type === "crypto" ? await getCryptoQuote(cryptoId) : await getStockQuote(asset.symbol);
  const history = asset.type === "crypto" ? await getCryptoHistory(cryptoId, "1Y") : await getStockHistory(asset.symbol, "1Y", "1D");

  return NextResponse.json(
    {
      asset: {
        ...asset,
        price: quote.quote.price,
        change: quote.quote.change,
        changePercent: quote.quote.changePercent,
        volume: quote.quote.volume,
        bars: history.candles,
        meta: {
          ...asset.meta,
          provider: quote.quote.provider,
          dataStatus: quote.quote.dataStatus,
          lastUpdated: quote.quote.timestamp,
          providerTimestamp: quote.quote.timestamp
        }
      },
      status: getRuntimeStatus()
    },
    {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=300"
      }
    }
  );
}
