import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { OptionOiChart } from "@/components/option-oi-chart";
import { PriceChart } from "@/components/price-chart";
import { ExpectedRangeVisual, MomentumVisual, PutCallVisual, TrendDeviation } from "@/components/indicator-visuals";
import { Footer, Header } from "@/components/site-chrome";
import { money, percent, STATUS_LABELS } from "@/lib/format";
import { getStockDashboard, isSupportedSymbol, STOCKS } from "@/lib/services/stock-dashboard-service";

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }): Promise<Metadata> {
  const symbol = (await params).symbol.toUpperCase();
  if (!isSupportedSymbol(symbol)) return {};
  return {
    title: `${symbol} 收盘分析`,
    description: `${STOCKS[symbol].name}的收盘行情、趋势指标与期权持仓研究看板。`,
    openGraph: { title: `${symbol} 收盘分析`, description: `${STOCKS[symbol].name}的收盘行情、趋势指标与期权持仓研究看板。`, images: [] },
    twitter: { card: "summary", title: `${symbol} 收盘分析`, description: `${STOCKS[symbol].name}的收盘行情、趋势指标与期权持仓研究看板。`, images: [] },
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
    return <main className="shell"><Header /><div className="detail-empty"><span className="ticker">{symbol}</span><h1>暂无可用数据。</h1><p>请先执行 <code>npm run sync:bootstrap</code>。</p><Link href="/">← 返回总览</Link></div><Footer /></main>;
  }

  const change = dashboard.quote.dailyChangePct;
  return (
    <main className="shell">
      <Header />
      <section className="dashboard-hero" style={{ "--accent": dashboard.accent } as React.CSSProperties}>
        <div><Link href="/" className="back-link">← 返回总览</Link><p className="eyebrow">{dashboard.symbol} · 收盘研究</p><h1>{dashboard.name}</h1></div>
        <div className="quote-block"><strong>{money(dashboard.quote.close)}</strong><span className={change !== null && change >= 0 ? "positive" : "negative"}>{change === null ? "—" : `${change >= 0 ? "+" : ""}${percent(change, true)}`}</span></div>
      </section>
      <div className="date-strip">
        <b>数据口径</b><span>股票数据截至 {dashboard.stockDate}</span><span>期权数据截至 {dashboard.optionsDate ?? "—"}</span><span>期权到期日 {dashboard.optionsExpiration ?? "—"}</span>
      </div>
      <section className="status-panel"><div><span>趋势状态</span><strong>{STATUS_LABELS[dashboard.quote.marketStatus]}</strong></div><p>依据收盘价、20/50/200日均线和 RSI14 的客观规则判断。</p></section>

      <section className="section-block"><div className="section-heading-row"><div><span className="section-index">01</span><h2>价格趋势</h2></div><div className="legend"><i className="close" />收盘价<i className="ma20" />20日均线<i className="ma50" />50日均线<i className="ma200" />200日均线</div></div>
        <div className="metric-grid four"><MetricCard label="收盘价" value={money(dashboard.quote.close)} /><MetricCard label="20日均线" value={money(dashboard.trend.ma20)} /><MetricCard label="50日均线" value={money(dashboard.trend.ma50)} /><MetricCard label="200日均线" value={money(dashboard.trend.ma200)} /></div>
        <TrendDeviation close={dashboard.quote.close} ma20={dashboard.trend.ma20} ma50={dashboard.trend.ma50} ma200={dashboard.trend.ma200} />
        <div className="chart-panel"><PriceChart data={dashboard.priceHistory} /></div>
      </section>

      <section className="section-block"><div className="section-heading-row"><div><span className="section-index">02</span><h2>动量与波动率</h2></div></div>
        <MomentumVisual rsi={dashboard.trend.rsi14} realizedVolatility={dashboard.trend.rv20} />
      </section>

      <section className="section-block"><div className="section-heading-row"><div><span className="section-index">03</span><h2>期权持仓与关键价位</h2></div></div>
        {!dashboard.optionsDate ? <div className="chart-empty">暂无可用期权数据</div> : <>
          <div className="options-visual-grid">
            <ExpectedRangeVisual close={dashboard.quote.close} lower={dashboard.options.expectedLower} upper={dashboard.options.expectedUpper} expectedMove={dashboard.options.expectedMove} expectedMovePct={dashboard.options.expectedMovePct} maxPain={dashboard.options.maxPain} callWall={dashboard.options.callWall} putWall={dashboard.options.putWall} />
            <PutCallVisual ratio={dashboard.options.putCallOi} atmIv={dashboard.options.atmIv} />
          </div>
          <div className="metric-grid options compact"><MetricCard label="最大痛点" value={money(dashboard.options.maxPain)} /><MetricCard label="看涨墙" value={money(dashboard.options.callWall)} /><MetricCard label="看跌墙" value={money(dashboard.options.putWall)} /><MetricCard label="平值隐含波动率" value={percent(dashboard.options.atmIv)} /></div>
          <div className="chart-panel oi-panel"><div className="chart-title"><h3>按行权价分布的未平仓量</h3><span><i className="call" />看涨 Call <i className="put" />看跌 Put</span></div><OptionOiChart data={dashboard.optionOpenInterest} /></div>
        </>}
      </section>
      <Footer />
    </main>
  );
}
