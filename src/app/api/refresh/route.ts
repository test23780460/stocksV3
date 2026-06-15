import { NextResponse } from "next/server";
import { getRuntimeStatus } from "../../../services/providerRegistry";

export const dynamic = "force-dynamic";

export async function POST() {
  const status = getRuntimeStatus();
  const lastUpdated = new Date().toISOString();

  return NextResponse.json(
    {
      status: status.demoMode ? "demo" : "queued",
      lastUpdated,
      message: status.demoMode
        ? "Demo refresh completed. Add provider keys in Vercel to enable secure live refresh jobs."
        : "Refresh request accepted. Provider work stays server-side and no private key is exposed.",
      providerStatus: status.providers
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
