import { getStockCards } from "@/lib/services/stock-dashboard-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ stocks: await getStockCards() });
  } catch {
    return Response.json({ error: "Dashboard data is unavailable" }, { status: 503 });
  }
}
