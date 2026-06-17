import { NextResponse } from "next/server";
import { getRuntimeStatus } from "../../../services/providerRegistry";
import { symbolSchema } from "../../../services/apiValidation";
import { z } from "zod";

export const dynamic = "force-dynamic";

const alertSchema = z.object({
  symbol: symbolSchema,
  type: z.enum(["Price above", "Price below", "Percentage gain", "Percentage loss", "Unusual volume", "Provider outage"]),
  value: z.union([z.string().trim().min(1).max(32), z.number()]),
  enabled: z.boolean().default(true)
});

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
  const parsed = alertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request", message: parsed.error.issues.map((issue) => issue.message).join(" ") }, { status: 400 });
  }
  return NextResponse.json(
    {
      status: getRuntimeStatus(),
      delivery: "demo-simulated",
      message: "Demo alert accepted locally. Persistent alert rules require Supabase Auth; delivery remains simulated until a notification provider is configured.",
      alert: {
        id: `demo-${Date.now()}`,
        ...parsed.data,
        lastChecked: null,
        lastTriggered: null,
        triggerCount: 0,
        demo: true
      }
    },
    { status: 202 }
  );
}
