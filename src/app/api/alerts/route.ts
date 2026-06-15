import { NextResponse } from "next/server";
import { getRuntimeStatus } from "../../../services/providerRegistry";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: getRuntimeStatus(),
    delivery: "demo-simulated",
    alerts: [
      { id: "price-msft", symbol: "MSFT", type: "Price above", value: "490", enabled: true, demo: true },
      { id: "risk-tsla", symbol: "TSLA", type: "Risk increase", value: "75", enabled: true, demo: true }
    ]
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(
    {
      status: getRuntimeStatus(),
      delivery: "demo-simulated",
      message: "Demo alert accepted locally. Persistent alerts require Supabase Auth and notification providers.",
      alert: {
        id: `demo-${Date.now()}`,
        ...body,
        demo: true
      }
    },
    { status: 202 }
  );
}
