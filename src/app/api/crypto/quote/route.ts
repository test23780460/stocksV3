import { NextResponse } from "next/server";
import { getCryptoQuote, notFoundResponse, serverErrorResponse } from "../../../../services/marketData";
import { booleanStringSchema, cryptoIdSchema, parseOrBadRequest } from "../../../../services/apiValidation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = parseOrBadRequest(cryptoIdSchema, url.searchParams.get("id") ?? "");
  const refresh = parseOrBadRequest(booleanStringSchema, url.searchParams.get("refresh") ?? undefined);

  if (id.error) return NextResponse.json(id.error, { status: 400 });
  if (refresh.error) return NextResponse.json(refresh.error, { status: 400 });

  try {
    const quote = await getCryptoQuote(id.data, { refresh: Boolean(refresh.data) });
    return NextResponse.json(quote, {
      headers: {
        "Cache-Control": refresh ? "no-store" : "s-maxage=30, stale-while-revalidate=120"
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("not")) {
      return NextResponse.json(notFoundResponse("Crypto id was not found."), { status: 404 });
    }
    return NextResponse.json(serverErrorResponse(), { status: 500 });
  }
}
