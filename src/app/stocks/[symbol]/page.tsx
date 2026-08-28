import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { DataScope, KeyDistanceMap, ResearchOverview, ScenarioObservation } from "@/components/decision-support";
import { DayOverDayStrip } from "@/components/day-over-day-change";
import { EventWindow } from "@/components/event-window";
import { OptionOiChart } from "@/components/option-oi-chart";
import { OptionStructureHistory } from "@/components/option-structure-history";
import { OptionWindowSelector } from "@/components/option-window-selector";
import { IvStructureVisual, WallStrengthVisual } from "@/components/option-insight-visuals";
import { PriceChart } from "@/components/price-chart";
import { ExpectedRangeVisual, GammaExposureVisual, MomentumInformation, MomentumVisual, PutCallVisual, TrendDeviation } from "@/components/indicator-visuals";
import { MetricLabel, type MetricHelpKey } from "@/components/metric-help";
import { ModuleJumpNav } from "@/components/module-jump-nav";
import { HistoricalPosition, SnapshotLink } from "@/components/product-insights";
import { SectionPager } from "@/components/section-pager";
import { Footer, Header } from "@/components/site-chrome";
import { VolumeProfileVisual } from "@/components/volume-profile-visual";
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

function MetricCard({ label, value, note, help }: { label: string; value: string; note?: string; help?: MetricHelpKey }) {
  return <div className="metric-card">{help ? <MetricLabel metric={help}>{label}</MetricLabel> : <span>{label}</span>}<strong>{value}</strong>{note && <small>{note}</small>}</div>;
}

function ModuleHeading({ index, kicker, title, description, canAnswer, cannotAnswer, accent, aside }: { index: string; kicker: string; title: string; description: string; canAnswer: string; cannotAnswer: string; accent: string; aside?: React.ReactNode }) {
  return (
    <div className="module-heading" style={{ "--module-accent": accent } as React.CSSProperties}>
      <strong className="module-number">{index}</strong>
      <div className="module-copy"><span>{kicker}</span><h2>{title}</h2><p>{description}</p><div className="module-answers"><span><b>能回答</b>{canAnswer}</span><span><b>不能回答</b>{cannotAnswer}</span></div></div>
      {aside && <div className="module-aside">{aside}</div>}
    </div>
  );
}

function businessDaysSince(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const datePart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const today = `${datePart("year")}-${datePart("month")}-${datePart("day")}`;
  const start = new Date(`${value}T00:00:00.000Z`);
  const end = new Date(`${today}T00:00:00.000Z`);
  let count = 0;
  for (const cursor = new Date(start.getTime() + 86_400_000); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) count += 1;
  }
  return count;
}

export default async function StockPage({ params, searchParams }: { params: Promise<{ symbol: string }>; searchParams: Promise<{ window?: string | string[] }> }) {
  const symbol = (await params).symbol.toUpperCase();
  if (!isSupportedSymbol(symbol)) notFound();
  const rawWindow = (await searchParams).window;
  const requestedWindow = typeof rawWindow === "string" ? rawWindow : null;
  await connection();
  let dashboard = null;
  try { dashboard = await getStockDashboard(symbol, requestedWindow); } catch { dashboard = null; }

  if (!dashboard) {
    return <main className="shell"><Header /><div className="detail-empty"><span className="ticker">{symbol}</span><h1>暂无可用数据。</h1><p>请先执行 <code>npm run sync:bootstrap</code>。</p><Link href="/">← 返回总览</Link></div><Footer /></main>;
  }

  const change = dashboard.quote.dailyChangePct;
  const staleBusinessDays = businessDaysSince(dashboard.stockDate);
  return (
    <main className="shell stock-detail">
      <Header />
      <section className="dashboard-hero" style={{ "--accent": dashboard.accent } as React.CSSProperties}>
        <div><Link href="/" className="back-link">← 返回总览</Link><p className="eyebrow">{dashboard.symbol} · 收盘研究</p><h1>{dashboard.name}</h1></div>
        <div className="quote-block"><strong>{money(dashboard.quote.close)}</strong><span className={change !== null && change >= 0 ? "positive" : "negative"}>{change === null ? "—" : `${change >= 0 ? "+" : ""}${percent(change, true)}`}</span><SnapshotLink symbol={symbol} window={dashboard.optionWindow} /></div>
      </section>
      {staleBusinessDays > 1 && <div className="stale-data-alert"><b>数据更新提醒</b><span>股票数据停留在 {dashboard.stockDate}，已间隔 {staleBusinessDays} 个工作日，请先确认数据是否完成同步。</span></div>}
      <ResearchOverview
        input={{ marketStatus: dashboard.quote.marketStatus, rsi14: dashboard.trend.rsi14, rv20: dashboard.trend.rv20, atmIv: dashboard.options.atmIv, gammaRegime: dashboard.options.gammaExposure.regime }}
        close={dashboard.quote.close}
        trendScore={dashboard.trend.score}
        confidence={dashboard.trend.confidence}
        stockDate={dashboard.stockDate}
        relativeVolume={dashboard.trend.relativeVolume}
        ivPercentile={dashboard.options.ivPercentile}
        levels={{ callWall: dashboard.options.callWall, putWall: dashboard.options.putWall, maxPain: dashboard.options.maxPain, expectedUpper: dashboard.options.expectedUpper, expectedLower: dashboard.options.expectedLower }}
      />
      <DayOverDayStrip change={dashboard.dayOverDay} currentStockDate={dashboard.stockDate} currentOptionsDate={dashboard.optionsDate} />
      <EventWindow symbol={symbol} assetType={dashboard.assetType} optionsExpiration={dashboard.optionsExpiration} />
      <ModuleJumpNav symbol={symbol} close={dashboard.quote.close} dailyChangePct={dashboard.quote.dailyChangePct} trendScore={dashboard.trend.score} confidenceLabel={dashboard.trend.confidence.label} optionWindowLabel={dashboard.optionWindowLabel} />
      <DataScope stockDate={dashboard.stockDate} optionsDate={dashboard.optionsDate} expiration={dashboard.optionsExpiration} optionWindow={dashboard.optionWindowLabel} strikeCount={dashboard.optionOpenInterest.length} stockProviders={dashboard.stockProviders} />

      <section className="section-block" id="module-price"><ModuleHeading index="01" kicker="价格结构" title="价格趋势与关键位" description="价格处在什么趋势，离重要期权价位还有多远。" canAnswer="趋势位置与关键价位距离" cannotAnswer="突破后的必然涨跌方向" accent="var(--positive)" />
        <SectionPager label="价格趋势与关键位视图" accent="var(--positive)" tabs={[
          { id: "price-chart", label: "K线图", content: <div className="chart-panel"><div className="chart-gesture-note"><span>↔ 左右拖动查看历史</span><span>成交量柱＋20日均量，点按读取 RVOL</span></div><PriceChart data={dashboard.priceHistory} levels={{ maxPain: dashboard.options.maxPain, callWall: dashboard.options.wallProfiles.call, putWall: dashboard.options.wallProfiles.put, expectedUpper: dashboard.options.expectedUpper, expectedLower: dashboard.options.expectedLower }} /></div> },
          { id: "price-trend", label: "趋势位置", content: <><div className="metric-grid four"><MetricCard label="收盘价" value={money(dashboard.quote.close)} /><MetricCard label="20日均线" value={money(dashboard.trend.ma20)} help="movingAverage" /><MetricCard label="50日均线" value={money(dashboard.trend.ma50)} help="movingAverage" /><MetricCard label="200日均线" value={money(dashboard.trend.ma200)} help="movingAverage" /></div><TrendDeviation close={dashboard.quote.close} ma20={dashboard.trend.ma20} ma50={dashboard.trend.ma50} ma200={dashboard.trend.ma200} /></> },
          { id: "price-distance", label: "关键距离", content: <KeyDistanceMap close={dashboard.quote.close} callWall={dashboard.options.callWall} putWall={dashboard.options.putWall} maxPain={dashboard.options.maxPain} expectedUpper={dashboard.options.expectedUpper} expectedLower={dashboard.options.expectedLower} expectedMove={dashboard.options.expectedMove} /> },
          { id: "price-scenarios", label: "情景观察", content: <ScenarioObservation input={{ close: dashboard.quote.close, callWall: dashboard.options.callWall, putWall: dashboard.options.putWall, marketStatus: dashboard.quote.marketStatus, gammaRegime: dashboard.options.gammaExposure.regime }} /> },
        ]} />
      </section>

      <section className="section-block" id="module-momentum"><ModuleHeading index="02" kicker="动量与波动" title="动量与波动率" description="判断走势是否过热，并比较近期实际波动与期权隐含定价。" canAnswer="动量冷热与波动定价差异" cannotAnswer="下一交易日涨跌或期权绝对贵贱" accent="var(--info)" />
        <SectionPager label="动量与波动率视图" accent="var(--info)" tabs={[
          { id: "momentum-overview", label: "动量概览", content: <MomentumVisual rsi={dashboard.trend.rsi14} realizedVolatility={dashboard.trend.rv20} /> },
          { id: "momentum-pricing", label: "波动定价", content: <><MomentumInformation rsi={dashboard.trend.rsi14} realizedVolatility={dashboard.trend.rv20} atmIv={dashboard.options.atmIv} /><IvStructureVisual currentIv={dashboard.options.atmIv} percentile={dashboard.options.ivPercentile} termStructure={dashboard.options.ivTermStructure} skew={dashboard.options.ivSkew} /></> },
          { id: "momentum-history", label: "历史位置", content: <HistoricalPosition positions={dashboard.historicalPositions} /> },
          { id: "momentum-volume-profile", label: "成交分布", content: <VolumeProfileVisual profile={dashboard.volumeProfile} close={dashboard.quote.close} /> },
        ]} />
      </section>

      <section className="section-block" id="module-options"><ModuleHeading index="03" kicker="期权持仓" title="期权持仓结构" description="观察未平仓量集中位置、预期区间与 Gamma 结构代理。" canAnswer="OI集中位置与到期波动定价" cannotAnswer="真实做市商方向或未来价格" accent="var(--warning)" />
        <OptionWindowSelector key={dashboard.optionWindow} symbol={symbol} selected={dashboard.optionWindow} counts={dashboard.optionWindowCounts} />
        <div className="option-scope-summary">
          <span><b>墙位 / OI / Gamma</b>{dashboard.optionWindowLabel}汇总 · {dashboard.optionWindowCounts[dashboard.optionWindow]} 份合约</span>
          <span><b>预期区间 / IV / 最大痛点</b>{dashboard.optionsExpiration ? `采用最近到期 ${dashboard.optionsExpiration}` : "当前范围暂无可用定价到期日"}</span>
        </div>
        {!dashboard.optionsDate ? <div className="chart-empty">暂无可用期权数据</div> : <>
          <SectionPager label="期权持仓结构视图" accent="var(--warning)" tabs={[
            { id: "options-range", label: "预期区间", content: <div className="options-visual-grid"><ExpectedRangeVisual close={dashboard.quote.close} lower={dashboard.options.expectedLower} upper={dashboard.options.expectedUpper} expectedMove={dashboard.options.expectedMove} expectedMovePct={dashboard.options.expectedMovePct} maxPain={dashboard.options.maxPain} callWall={dashboard.options.callWall} putWall={dashboard.options.putWall} /><PutCallVisual ratio={dashboard.options.putCallOi} atmIv={dashboard.options.atmIv} /></div> },
            { id: "options-gamma", label: "Gamma", content: <GammaExposureVisual {...dashboard.options.gammaExposure} /> },
            { id: "options-oi", label: "未平仓量", content: <><WallStrengthVisual call={dashboard.options.wallProfiles.call} put={dashboard.options.wallProfiles.put} /><div className="chart-panel oi-panel"><div className="chart-title"><div><h3><MetricLabel metric="openInterest">按行权价分布的未平仓量</MetricLabel></h3><small>同一价格轴 · 看涨（Call）向上 / 看跌（Put）向下</small></div><span><i className="call" />看涨（Call） <i className="put" />看跌（Put）</span></div><OptionOiChart data={dashboard.optionOpenInterest} change={dashboard.optionOpenInterestChange} /></div></> },
            { id: "options-history", label: "墙位迁移", content: <OptionStructureHistory history={dashboard.optionResearchHistory} /> },
          ]} />
        </>}
      </section>
      <Footer />
    </main>
  );
}
