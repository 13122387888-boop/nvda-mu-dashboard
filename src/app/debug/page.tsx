import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Footer, Header } from "@/components/site-chrome";
import { getDebugSnapshot } from "@/lib/services/stock-dashboard-service";

export default async function DebugPage() {
  await connection();
  if (process.env.ENABLE_DEBUG_PAGE !== "true") notFound();
  let rows: Awaited<ReturnType<typeof getDebugSnapshot>>;
  try { rows = await getDebugSnapshot(); } catch { rows = []; }
  return <main className="shell"><Header /><section className="debug-page"><p className="eyebrow">PRIVATE DIAGNOSTICS</p><h1>Data pipeline status</h1><div className="debug-grid">{rows.map((row) => <article className="debug-card" key={row.symbol}><span className="ticker">{row.symbol}</span><dl><div><dt>Latest Stock Date</dt><dd>{row.latestStockDate ?? "—"}</dd></div><div><dt>Stock Row Count</dt><dd>{row.stockRowCount}</dd></div><div><dt>Latest Option Date</dt><dd>{row.latestOptionDate ?? "—"}</dd></div><div><dt>Option Contract Count</dt><dd>{row.optionContractCount}</dd></div><div><dt>Latest Metrics Date</dt><dd>{row.latestMetricsDate ?? "—"}</dd></div><div><dt>Last Sync Status</dt><dd>{row.lastSyncStatus ?? "—"}</dd></div><div><dt>Last Sync Time</dt><dd>{row.lastSyncTime ?? "—"}</dd></div></dl></article>)}</div>{!rows.length && <div className="empty-callout">Database diagnostics unavailable.</div>}</section><Footer /></main>;
}
