import { loadDataHealthSummary } from "@/lib/services/data-health-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = await loadDataHealthSummary();
    return Response.json({ database: "connected", ...health }, { status: health.status === "error" ? 503 : 200 });
  } catch {
    return Response.json({ status: "error", database: "unavailable", asOf: null, latestRun: null }, { status: 503 });
  }
}
