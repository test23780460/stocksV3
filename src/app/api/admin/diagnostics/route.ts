import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../services/adminAuth";
import { getRuntimeStatus } from "../../../../services/marketData";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.status === 401 ? "unauthenticated" : "forbidden", message: admin.message }, { status: admin.status });
  }

  const status = getRuntimeStatus();
  return NextResponse.json(
    {
      appVersion: "0.1.0",
      deploymentCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || "local",
      generatedAt: new Date().toISOString(),
      providerConnectionStatus: status.providers,
      databaseConfigured: status.supabaseServerConfigured,
      cronConfigured: true,
      cronSchedule: status.cronSchedule,
      cacheBackend: status.cacheBackend,
      authenticationConfigured: status.supabasePublicConfigured,
      secretsExposed: false
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
