import { NextResponse } from "next/server";
import { getCryptoQuote, notFoundResponse, serverErrorResponse } from "../../../../services/marketData";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();
  const refresh = url.searchParams.get("refresh") === "true";

  if (!id) {
    return NextResponse.json({ error: "bad_request", message: "Missing required id query parameter." }, { status: 400 });
  }

  try {
    const quote = await getCryptoQuote(id, { refresh });
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
