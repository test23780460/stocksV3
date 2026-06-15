import { NextResponse } from "next/server";
import { getRuntimeStatus } from "../../../services/providerRegistry";

export const dynamic = "force-dynamic";

const authorize = (request: Request) => {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${expectedSecret}`;
};

const runIngest = (request: Request) => {
  if (!authorize(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const status = getRuntimeStatus();
  const payload = {
    event: "market_ingest_checked",
    at: new Date().toISOString(),
    mode: status.demoMode ? "demo" : "provider-ready",
    wroteRemoteData: false,
    message: status.demoMode
      ? "Vercel cron reached the ingestion route. Demo Mode stayed active because provider keys are missing."
      : "Vercel cron reached the ingestion route. Provider adapters can safely run server-side from here.",
    status
  };

  console.log(
    JSON.stringify({
      event: payload.event,
      at: payload.at,
      mode: payload.mode,
      providerCount: status.providers.filter((provider) => provider.configured).length,
      supabaseServerConfigured: status.supabaseServerConfigured
    })
  );

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
};

export async function GET(request: Request) {
  return runIngest(request);
}

export async function POST(request: Request) {
  return runIngest(request);
}
