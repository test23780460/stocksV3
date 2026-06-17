import { NextResponse } from "next/server";
import { demoAssets } from "../../../../data/fixtures";
import { cryptoIdForSymbol, getCryptoHistory, getCryptoQuote, getRuntimeStatus, getStockHistory, getStockQuote } from "../../../../services/marketData";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await context.params;
  const asset = demoAssets.find((item) => item.symbol.toUpperCase() === symbol.toUpperCase());

  if (!asset) {
    return NextResponse.json(
      {
        error: "asset_not_found",
        message: "This symbol is not available in the current Demo Mode fixture set.",
        symbol: symbol.toUpperCase(),
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
