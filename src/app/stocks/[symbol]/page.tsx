import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { DataScope, KeyDistanceMap, ResearchBrief, ScenarioObservation } from "@/components/decision-support";
import { OptionOiChart } from "@/components/option-oi-chart";
import { PriceChart } from "@/components/price-chart";
import { ExpectedRangeVisual, GammaExposureVisual, MomentumInformation, MomentumVisual, PutCallVisual, TrendDeviation } from "@/components/indicator-visuals";
import { SectionPager } from "@/components/section-pager";
import { Footer, Header } from "@/components/site-chrome";
import { money, percent } from "@/lib/format";
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

function ModuleHeading({ index, kicker, title, description, accent, aside }: { index: string; kicker: string; title: string; description: string; accent: string; aside?: React.ReactNode }) {
  return (
    <div className="module-heading" style={{ "--module-accent": accent } as React.CSSProperties}>
      <strong className="module-number">{index}</strong>
      <div className="module-copy"><span>{kicker}</span><h2>{title}</h2><p>{description}</p></div>
      {aside && <div className="module-aside">{aside}</div>}
    </div>
  );
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
      <DataScope stockDate={dashboard.stockDate} optionsDate={dashboard.optionsDate} expiration={dashboard.optionsExpiration} strikeCount={dashboard.optionOpenInterest.length} />
      <ResearchBrief input={{ marketStatus: dashboard.quote.marketStatus, rsi14: dashboard.trend.rsi14, rv20: dashboard.trend.rv20, atmIv: dashboard.options.atmIv, gammaRegime: dashboard.options.gammaExposure.regime }} />

      <section className="section-block"><ModuleHeading index="01" kicker="PRICE STRUCTURE" title="价格趋势与关键位" description="价格处在什么趋势，离重要期权价位还有多远。" accent="#57d68d" aside={<div className="legend"><i className="candle" />日K<i className="ma20" />20日均线<i className="ma50" />50日均线<i className="ma200" />200日均线</div>} />
        <SectionPager label="价格趋势与关键位视图" accent="#57d68d" tabs={[
          { id: "price-trend", label: "趋势位置", content: <><div className="metric-grid four"><MetricCard label="收盘价" value={money(dashboard.quote.close)} /><MetricCard label="20日均线" value={money(dashboard.trend.ma20)} /><MetricCard label="50日均线" value={money(dashboard.trend.ma50)} /><MetricCard label="200日均线" value={money(dashboard.trend.ma200)} /></div><TrendDeviation close={dashboard.quote.close} ma20={dashboard.trend.ma20} ma50={dashboard.trend.ma50} ma200={dashboard.trend.ma200} /></> },
          { id: "price-distance", label: "关键距离", content: <KeyDistanceMap close={dashboard.quote.close} callWall={dashboard.options.callWall} putWall={dashboard.options.putWall} maxPain={dashboard.options.maxPain} expectedUpper={dashboard.options.expectedUpper} expectedLower={dashboard.options.expectedLower} expectedMove={dashboard.options.expectedMove} /> },
          { id: "price-chart", label: "K线图", content: <div className="chart-panel"><div className="chart-gesture-note"><span>↔ 左右拖动查看历史</span><b>↕ 上下滑动页面</b></div><PriceChart data={dashboard.priceHistory} levels={{ maxPain: dashboard.options.maxPain, callWall: dashboard.options.callWall, putWall: dashboard.options.putWall, expectedUpper: dashboard.options.expectedUpper, expectedLower: dashboard.options.expectedLower }} /></div> },
          { id: "price-scenarios", label: "情景观察", content: <ScenarioObservation input={{ close: dashboard.quote.close, callWall: dashboard.options.callWall, putWall: dashboard.options.putWall, marketStatus: dashboard.quote.marketStatus, gammaRegime: dashboard.options.gammaExposure.regime }} /> },
        ]} />
      </section>

      <section className="section-block"><ModuleHeading index="02" kicker="MOMENTUM & VOLATILITY" title="动量与波动率" description="判断走势是否过热，并比较近期实际波动与期权隐含定价。" accent="#4f8cff" />
        <SectionPager label="动量与波动率视图" accent="#4f8cff" tabs={[
          { id: "momentum-overview", label: "动量概览", content: <MomentumVisual rsi={dashboard.trend.rsi14} realizedVolatility={dashboard.trend.rv20} /> },
          { id: "momentum-pricing", label: "波动定价", content: <MomentumInformation rsi={dashboard.trend.rsi14} realizedVolatility={dashboard.trend.rv20} atmIv={dashboard.options.atmIv} /> },
        ]} />
      </section>

      <section className="section-block"><ModuleHeading index="03" kicker="OPTIONS POSITIONING" title="期权持仓结构" description="观察未平仓量集中位置、预期区间与 Gamma 结构代理。" accent="#f0b45c" />
        {!dashboard.optionsDate ? <div className="chart-empty">暂无可用期权数据</div> : <>
          <SectionPager label="期权持仓结构视图" accent="#f0b45c" tabs={[
            { id: "options-range", label: "预期区间", content: <div className="options-visual-grid"><ExpectedRangeVisual close={dashboard.quote.close} lower={dashboard.options.expectedLower} upper={dashboard.options.expectedUpper} expectedMove={dashboard.options.expectedMove} expectedMovePct={dashboard.options.expectedMovePct} maxPain={dashboard.options.maxPain} callWall={dashboard.options.callWall} putWall={dashboard.options.putWall} /><PutCallVisual ratio={dashboard.options.putCallOi} atmIv={dashboard.options.atmIv} /></div> },
            { id: "options-gamma", label: "Gamma", content: <GammaExposureVisual {...dashboard.options.gammaExposure} /> },
            { id: "options-oi", label: "未平仓量", content: <><div className="metric-grid options compact"><MetricCard label="最大痛点" value={money(dashboard.options.maxPain)} /><MetricCard label="看涨墙" value={money(dashboard.options.callWall)} /><MetricCard label="看跌墙" value={money(dashboard.options.putWall)} /><MetricCard label="平值隐含波动率" value={percent(dashboard.options.atmIv)} /></div><div className="chart-panel oi-panel"><div className="chart-title"><div><h3>按行权价分布的未平仓量</h3><small>同一价格轴 · Call 向上 / Put 向下</small></div><span><i className="call" />看涨 Call <i className="put" />看跌 Put</span></div><OptionOiChart data={dashboard.optionOpenInterest} /></div></> },
          ]} />
        </>}
      </section>
      <Footer />
    </main>
  );
}
