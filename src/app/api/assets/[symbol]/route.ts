import { NextResponse } from "next/server";
import { findAsset, getRuntimeStatus } from "../../../../services/providerRegistry";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await context.params;
  const asset = findAsset(symbol);

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

  return NextResponse.json(
    {
      asset,
      status: getRuntimeStatus()
    },
    {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=300"
      }
    }
  );
}
