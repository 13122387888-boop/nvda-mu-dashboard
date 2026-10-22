import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { SnapshotActions } from "@/components/snapshot-actions";
import { Header, Footer } from "@/components/site-chrome";
import {
  getStockDashboard,
  isSupportedSymbol,
} from "@/lib/services/stock-dashboard-service";
import { money, number, percent, STATUS_LABELS } from "@/lib/format";
export default async function SnapshotPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const symbol = (await params).symbol.toUpperCase();
  if (!isSupportedSymbol(symbol)) notFound();
  await connection();
  const d = await getStockDashboard(symbol);
  if (!d) notFound();
  const summary =
    STATUS_LABELS[d.quote.marketStatus] +
    " · 趋势分 " +
    (d.trend.score ?? "样本不足") +
    " · RSI " +
    number(d.trend.rsi14, 1) +
    " · 相对成交量 " +
    number(d.trend.relativeVolume, 1) +
    "倍";
  return (
    <main className="shell snapshot-page">
      <Header />
      <div className="snapshot-toolbar">
        <Link href={"/stocks/" + symbol}>← 返回研究页</Link>
        <SnapshotActions
          data={{ symbol, name: d.name, stockDate: d.stockDate, summary }}
        />
      </div>
      <section className="snapshot-card">
        <header>
          <div>
            <b>{symbol}</b>
            <h1>{d.name}</h1>
          </div>
          <small>长桥 · {d.stockDate}</small>
        </header>
        <div className="snapshot-quote">
          <strong>{money(d.quote.close)}</strong>
          <span>{percent(d.quote.dailyChangePct, true)}</span>
        </div>
        <p className="snapshot-summary">{summary}</p>
        <p>
          50日线 {money(d.trend.ma50)} · 100日线 {money(d.trend.ma100)} ·
          200日线 {money(d.trend.ma200)}
        </p>
      </section>
      <Footer />
    </main>
  );
}
