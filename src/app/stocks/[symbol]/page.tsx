import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { OptionOiChart } from "@/components/option-oi-chart";
import { PriceChart } from "@/components/price-chart";
import { Footer, Header } from "@/components/site-chrome";
import { money, number, percent, STATUS_LABELS } from "@/lib/format";
import { getStockDashboard, isSupportedSymbol, STOCKS } from "@/lib/services/stock-dashboard-service";

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }): Promise<Metadata> {
  const symbol = (await params).symbol.toUpperCase();
  if (!isSupportedSymbol(symbol)) return {};
  return {
    title: `${symbol} EOD Dashboard`,
    description: `${STOCKS[symbol].name} EOD stock and options research dashboard.`,
    openGraph: { title: `${symbol} EOD Dashboard`, description: `${STOCKS[symbol].name} EOD stock and options research dashboard.`, images: [] },
    twitter: { card: "summary", title: `${symbol} EOD Dashboard`, description: `${STOCKS[symbol].name} EOD stock and options research dashboard.`, images: [] },
  };
}

function MetricCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const symbol = (await params).symbol.toUpperCase();
  if (!isSupportedSymbol(symbol)) notFound();
  await connection();
  let dashboard = null;
  try { dashboard = await getStockDashboard(symbol); } catch { dashboard = null; }

  if (!dashboard) {
    return <main className="shell"><Header /><div className="detail-empty"><span className="ticker">{symbol}</span><h1>No data available.</h1><p>Run <code>npm run sync:bootstrap</code> first.</p><Link href="/">← Back to overview</Link></div><Footer /></main>;
  }

  const change = dashboard.quote.dailyChangePct;
  return (
    <main className="shell">
      <Header />
      <section className="dashboard-hero" style={{ "--accent": dashboard.accent } as React.CSSProperties}>
        <div><Link href="/" className="back-link">← Overview</Link><p className="eyebrow">{dashboard.symbol} · EOD RESEARCH</p><h1>{dashboard.name}</h1></div>
        <div className="quote-block"><strong>{money(dashboard.quote.close)}</strong><span className={change !== null && change >= 0 ? "positive" : "negative"}>{change === null ? "—" : `${change >= 0 ? "+" : ""}${percent(change, true)}`}</span></div>
      </section>
      <div className="date-strip">
        <b>EOD Data</b><span>Stock data as of {dashboard.stockDate}</span><span>Options data as of {dashboard.optionsDate ?? "—"}</span><span>Options expiration {dashboard.optionsExpiration ?? "—"}</span>
      </div>
      <section className="status-panel"><div><span>MARKET STATUS</span><strong>{STATUS_LABELS[dashboard.quote.marketStatus]}</strong></div><p>Objective trend rules using close, moving averages and RSI14.</p></section>

      <section className="section-block"><div className="section-heading-row"><div><span className="section-index">01</span><h2>Trend</h2></div><div className="legend"><i className="close" />Close<i className="ma20" />MA20<i className="ma50" />MA50<i className="ma200" />MA200</div></div>
        <div className="metric-grid four"><MetricCard label="Close" value={money(dashboard.quote.close)} /><MetricCard label="MA20" value={money(dashboard.trend.ma20)} /><MetricCard label="MA50" value={money(dashboard.trend.ma50)} /><MetricCard label="MA200" value={money(dashboard.trend.ma200)} /></div>
        <div className="chart-panel"><PriceChart data={dashboard.priceHistory} /></div>
      </section>

      <section className="section-block"><div className="section-heading-row"><div><span className="section-index">02</span><h2>Momentum &amp; Volatility</h2></div></div>
        <div className="metric-grid two"><MetricCard label="RSI14" value={number(dashboard.trend.rsi14)} note="Wilder · 14 sessions" /><MetricCard label="RV20" value={percent(dashboard.trend.rv20)} note="Annualized · 20 sessions" /></div>
      </section>

      <section className="section-block"><div className="section-heading-row"><div><span className="section-index">03</span><h2>Options Positioning</h2></div></div>
        {!dashboard.optionsDate ? <div className="chart-empty">Options data unavailable</div> : <>
          <div className="metric-grid options"><MetricCard label="Expected Move" value={dashboard.options.expectedMove === null ? "—" : `± ${money(dashboard.options.expectedMove)}`} note={dashboard.options.expectedMovePct === null ? undefined : `± ${percent(dashboard.options.expectedMovePct)}`} /><MetricCard label="Expected Upper" value={money(dashboard.options.expectedUpper)} /><MetricCard label="Expected Lower" value={money(dashboard.options.expectedLower)} /><MetricCard label="Put / Call OI" value={number(dashboard.options.putCallOi)} /><MetricCard label="Max Pain" value={money(dashboard.options.maxPain)} /><MetricCard label="Call Wall" value={money(dashboard.options.callWall)} /><MetricCard label="Put Wall" value={money(dashboard.options.putWall)} /><MetricCard label="ATM IV" value={percent(dashboard.options.atmIv)} /></div>
          <div className="chart-panel oi-panel"><div className="chart-title"><h3>Open Interest by Strike</h3><span><i className="call" />Call OI <i className="put" />Put OI</span></div><OptionOiChart data={dashboard.optionOpenInterest} /></div>
        </>}
      </section>
      <Footer />
    </main>
  );
}
