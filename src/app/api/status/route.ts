import { NextResponse } from "next/server";
import { getRuntimeStatusWithCollector } from "../../../services/collectorData";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getRuntimeStatusWithCollector(), {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
