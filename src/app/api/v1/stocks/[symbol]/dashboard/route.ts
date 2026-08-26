import { getStockDashboard, isSupportedSymbol } from "@/lib/services/stock-dashboard-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ symbol: string }> }) {
  const symbol = (await context.params).symbol.toUpperCase();
  if (!isSupportedSymbol(symbol)) return Response.json({ error: "Stock not found" }, { status: 404 });
  try {
    const dashboard = await getStockDashboard(symbol);
    if (!dashboard) return Response.json({ error: "No data available" }, { status: 404 });
    return Response.json(dashboard);
  } catch {
    return Response.json({ error: "Dashboard data is unavailable" }, { status: 503 });
  }
}
