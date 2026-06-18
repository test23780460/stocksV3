import { NextResponse } from "next/server";
import { getSupabaseAdmin, hasSupabaseServerConfig } from "../../../services/supabaseServer";
import { parseOrBadRequest, safeQuerySchema } from "../../../services/apiValidation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = parseOrBadRequest(safeQuerySchema, url.searchParams.get("type") ?? "highest_scanner_score");
  if (type.error) return NextResponse.json(type.error, { status: 400 });
  const supabase = getSupabaseAdmin();
  if (!supabase || !hasSupabaseServerConfig()) {
    return NextResponse.json({ results: [], mode: "unavailable", message: "Supabase collector tables are not configured." }, { headers: { "Cache-Control": "no-store" } });
  }
  const { data, error } = await supabase
    .from("scanner_results")
    .select("*, market_assets(symbol, company_name, exchange)")
    .eq("scanner_type", type.data)
    .gt("expires_at", new Date().toISOString())
    .order("rank", { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ results: [], mode: "unavailable", message: "Scanner results are not available yet." }, { status: 200 });
  return NextResponse.json({ results: data ?? [], mode: "collector", generatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=120" } });
}
