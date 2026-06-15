import { NextResponse } from "next/server";
import { getRuntimeStatus } from "../../../services/providerRegistry";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getRuntimeStatus(), {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
