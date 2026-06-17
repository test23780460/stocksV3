import { NextResponse } from "next/server";
import { getCryptoHistory, notFoundResponse, serverErrorResponse } from "../../../../services/marketData";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();
  const range = url.searchParams.get("range") || "1Y";
  const refresh = url.searchParams.get("refresh") === "true";

  if (!id) {
    return NextResponse.json({ error: "bad_request", message: "Missing required id query parameter." }, { status: 400 });
  }

  try {
    const history = await getCryptoHistory(id, range, { refresh });
    return NextResponse.json(history, {
      headers: {
        "Cache-Control": refresh ? "no-store" : "s-maxage=300, stale-while-revalidate=1800"
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("not")) {
      return NextResponse.json(notFoundResponse("Historical data was not found for this crypto id."), { status: 404 });
    }
    return NextResponse.json(serverErrorResponse(), { status: 500 });
  }
}
