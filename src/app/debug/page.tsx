import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Footer, Header } from "@/components/site-chrome";
import { getDebugSnapshot } from "@/lib/services/stock-dashboard-service";

export default async function DebugPage() {
  await connection();
  if (process.env.ENABLE_DEBUG_PAGE !== "true") notFound();
  let rows: Awaited<ReturnType<typeof getDebugSnapshot>>;
  try { rows = await getDebugSnapshot(); } catch { rows = []; }
  return <main className="shell"><Header /><section className="debug-page"><p className="eyebrow">内部诊断</p><h1>数据管道状态</h1><div className="debug-grid">{rows.map((row) => <article className="debug-card" key={row.symbol}><span className="ticker">{row.symbol}</span><dl><div><dt>最新股票日期</dt><dd>{row.latestStockDate ?? "—"}</dd></div><div><dt>股票数据行数</dt><dd>{row.stockRowCount}</dd></div><div><dt>最新期权日期</dt><dd>{row.latestOptionDate ?? "—"}</dd></div><div><dt>期权合约数量</dt><dd>{row.optionContractCount}</dd></div><div><dt>最新指标日期</dt><dd>{row.latestMetricsDate ?? "—"}</dd></div><div><dt>最近同步状态</dt><dd>{row.lastSyncStatus ?? "—"}</dd></div><div><dt>最近同步时间</dt><dd>{row.lastSyncTime ?? "—"}</dd></div></dl></article>)}</div>{!rows.length && <div className="empty-callout">暂时无法读取数据库诊断信息。</div>}</section><Footer /></main>;
}
