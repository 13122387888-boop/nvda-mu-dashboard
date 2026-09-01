import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { DataScope, KeyDistanceMap, ResearchOverview, ScenarioObservation } from "@/components/decision-support";
import { DayOverDayStrip } from "@/components/day-over-day-change";
import { OptionOiChart } from "@/components/option-oi-chart";
import { OptionStructureHistory } from "@/components/option-structure-history";
import { OptionWindowSelector } from "@/components/option-window-selector";
import { IvStructureVisual, WallStrengthVisual } from "@/components/option-insight-visuals";
import { PriceChart } from "@/components/price-chart";
import { ExpectedRangeVisual, GammaExposureVisual, MomentumInformation, MomentumVisual, PutCallVisual, TrendDeviation } from "@/components/indicator-visuals";
import { MetricLabel } from "@/components/metric-help";
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
    title: `${symbol} 收盘观察`,
    description: `用简单中文查看 ${STOCKS[symbol].name} 的趋势、成交量、关键价位和期权结构。`,
    openGraph: { title: `${symbol} 收盘观察`, description: `用简单中文查看 ${STOCKS[symbol].name} 的趋势、成交量、关键价位和期权结构。`, images: [] },
    twitter: { card: "summary", title: `${symbol} 收盘观察`, description: `用简单中文查看 ${STOCKS[symbol].name} 的趋势、成交量、关键价位和期权结构。`, images: [] },
  };
}

function ModuleHeading({ index, kicker, title, description, canAnswer, cannotAnswer, accent, aside }: { index: string; kicker: string; title: string; description: string; canAnswer: string; cannotAnswer: string; accent: string; aside?: React.ReactNode }) {
  return (
    <div className="module-heading" style={{ "--module-accent": accent } as React.CSSProperties}>
      <strong className="module-number">{index}</strong>
      <div className="module-copy"><span>{kicker}</span><h2>{title}</h2><p>{description}</p><div className="module-answers"><span><b>这里能看</b>{canAnswer}</span><span><b>这里看不出</b>{cannotAnswer}</span></div></div>
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
    return <main className="shell"><Header /><div className="detail-empty"><span className="ticker">{symbol}</span><h1>暂时没有可显示的数据</h1><p>可能还在更新，请稍后再试。</p><Link href="/">← 返回首页</Link></div><Footer /></main>;
  }

  const change = dashboard.quote.dailyChangePct;
  const staleBusinessDays = businessDaysSince(dashboard.stockDate);
  const exactOptionSnapshot = dashboard.optionFreshness.isCurrent && dashboard.optionFreshness.ageBusinessDays === 0;
  const decisionInput = {
    marketStatus: dashboard.quote.marketStatus,
    rsi14: dashboard.trend.rsi14,
    relativeVolume: dashboard.trend.relativeVolume,
    dailyChangePct: dashboard.quote.dailyChangePct,
    bollinger: {
      percentB: dashboard.trend.bollinger.percentB,
      bandwidthPercentile: dashboard.trend.bollinger.bandwidthPercentile,
      state: dashboard.trend.bollinger.state,
    },
    rv20: dashboard.trend.rv20,
    atmIv: exactOptionSnapshot ? dashboard.options.atmIv : null,
    gammaRegime: exactOptionSnapshot ? dashboard.options.gammaExposure.regime : "UNAVAILABLE" as const,
  };
  const keyLevels = exactOptionSnapshot
    ? { callWall: dashboard.options.callWall, putWall: dashboard.options.putWall, maxPain: dashboard.options.maxPain, expectedUpper: dashboard.options.expectedUpper, expectedLower: dashboard.options.expectedLower }
    : { callWall: null, putWall: null, maxPain: null, expectedUpper: null, expectedLower: null };
  return (
    <main className="shell stock-detail">
      <Header />
      <section className="dashboard-hero" style={{ "--accent": dashboard.accent } as React.CSSProperties}>
        <div><Link href="/" className="back-link">← 返回首页</Link><p className="eyebrow">{dashboard.symbol} · 收盘后观察</p><h1>{dashboard.name}</h1></div>
        <div className="quote-block"><strong>{money(dashboard.quote.close)}</strong><span className={change !== null && change >= 0 ? "positive" : "negative"}>{change === null ? "—" : `${change >= 0 ? "+" : ""}${percent(change, true)}`}</span><SnapshotLink symbol={symbol} window={dashboard.optionWindow} /></div>
      </section>
      {staleBusinessDays > 1 && <div className="stale-data-alert"><b>数据可能没有更新</b><span>最后一个股票交易日是 {dashboard.stockDate}，距今已有 {staleBusinessDays} 个工作日，页面结论可能已经过时。</span></div>}
      <ResearchOverview
        input={decisionInput}
        close={dashboard.quote.close}
        trendScore={dashboard.trend.score}
        confidence={dashboard.trend.confidence}
        stockDate={dashboard.stockDate}
        levels={keyLevels}
      />
      <DayOverDayStrip change={dashboard.dayOverDay} currentStockDate={dashboard.stockDate} currentOptionsDate={dashboard.optionFreshness.ageBusinessDays === 0 ? dashboard.optionsDate : null} />
      <ModuleJumpNav symbol={symbol} close={dashboard.quote.close} dailyChangePct={dashboard.quote.dailyChangePct} trendScore={dashboard.trend.score} confidenceLabel={dashboard.trend.confidence.label} optionWindowLabel={dashboard.optionWindowLabel} />
      <DataScope stockDate={dashboard.stockDate} optionsDate={dashboard.optionsSnapshotDate} optionFreshness={dashboard.optionFreshness} expiration={dashboard.optionsExpiration} optionWindow={dashboard.optionWindowLabel} strikeCount={dashboard.optionOpenInterest.length} stockProviders={dashboard.stockProviders} optionQuality={dashboard.dataQuality.options} />

      <section className="section-block" id="module-price"><ModuleHeading index="01" kicker="价格在哪里" title="趋势、均线和关键价位" description="先看价格在均线上方还是下方，再看离期权重点价位还有多远。" canAnswer="当前趋势、重要价位和距离" cannotAnswer="突破以后一定会涨还是跌" accent="var(--positive)" />
        <SectionPager label="价格与关键价位" accent="var(--positive)" tabs={[
          { id: "price-chart", label: "K线图", content: <div className="chart-panel"><div className="chart-gesture-note"><span>↔ 左右拖动查看历史</span><span>下方柱子是成交量；点一下可看当天是平时的几倍</span></div><PriceChart data={dashboard.priceHistory} levels={{ maxPain: dashboard.options.maxPain, callWall: dashboard.options.wallProfiles.call, putWall: dashboard.options.wallProfiles.put, expectedUpper: dashboard.options.expectedUpper, expectedLower: dashboard.options.expectedLower }} /></div> },
          { id: "price-trend", label: "均线位置", content: <TrendDeviation close={dashboard.quote.close} ma50={dashboard.trend.ma50} ma100={dashboard.trend.ma100} ma200={dashboard.trend.ma200} breakdown={dashboard.trend.breakdown} /> },
          { id: "price-distance", label: "离关键位多远", content: <KeyDistanceMap close={dashboard.quote.close} callWall={dashboard.options.callWall} putWall={dashboard.options.putWall} maxPain={dashboard.options.maxPain} expectedUpper={dashboard.options.expectedUpper} expectedLower={dashboard.options.expectedLower} expectedMove={dashboard.options.expectedMove} /> },
          { id: "price-scenarios", label: "到了以后看什么", content: <ScenarioObservation input={{ close: dashboard.quote.close, callWall: exactOptionSnapshot ? dashboard.options.callWall : null, putWall: exactOptionSnapshot ? dashboard.options.putWall : null, marketStatus: dashboard.quote.marketStatus, gammaRegime: exactOptionSnapshot ? dashboard.options.gammaExposure.regime : "UNAVAILABLE" }} /> },
        ]} />
      </section>

      <section className="section-block" id="module-momentum"><ModuleHeading index="02" kicker="近期状态" title="近期偏强还是偏弱，波动处在什么水平" description="用 RSI 和布林带看近期强弱，再比较期权预计波动与过去实际波动。" canAnswer="近期冷热、价格通道位置和波动大小" cannotAnswer="明天涨跌或期权一定贵、一定便宜" accent="var(--info)" />
        <SectionPager label="近期强弱与波动" accent="var(--info)" tabs={[
          { id: "momentum-overview", label: "近期强弱", content: <MomentumVisual rsi={dashboard.trend.rsi14} realizedVolatility={dashboard.trend.rv20} close={dashboard.quote.close} bollinger={dashboard.trend.bollinger} /> },
          { id: "momentum-pricing", label: "期权预估", content: <><MomentumInformation rsi={dashboard.trend.rsi14} realizedVolatility={dashboard.trend.rv20} atmIv={dashboard.options.atmIv} /><IvStructureVisual currentIv={dashboard.options.atmIv} percentile={dashboard.options.ivPercentile} termStructure={dashboard.options.ivTermStructure} skew={dashboard.options.ivSkew} /></> },
          { id: "momentum-history", label: "和过去比", content: <HistoricalPosition positions={dashboard.historicalPositions} /> },
          { id: "momentum-volume-profile", label: "成交密集区", content: <VolumeProfileVisual profile={dashboard.volumeProfile} close={dashboard.quote.close} /> },
        ]} />
      </section>

      <section className="section-block" id="module-options"><ModuleHeading index="03" kicker="期权怎么看" title="合约集中在哪里，市场预计多大波动" description="看未结束合约集中在哪些价位，以及期权价格正在计入多大的到期前波动。" canAnswer="合约集中价位、最近到期波动范围和波动结构" cannotAnswer="谁在买卖，或者未来价格一定到哪里" accent="var(--warning)" />
        {dashboard.optionFreshness.isCurrent && <OptionWindowSelector key={dashboard.optionWindow} symbol={symbol} selected={dashboard.optionWindow} counts={dashboard.optionWindowCounts} />}
        <div className="option-scope-summary">
          <span><b>期权状态</b><em>{dashboard.optionFreshness.isCurrent ? dashboard.optionFreshness.ageBusinessDays === 0 ? `${dashboard.optionWindowLabel} · ${dashboard.optionWindowCounts[dashboard.optionWindow]} 条记录` : `最近快照 ${dashboard.optionsSnapshotDate} · ${dashboard.optionWindowCounts[dashboard.optionWindow]} 条记录` : dashboard.optionFreshness.status === "HISTORICAL" ? "历史快照 · 不用于当前结论" : "当前暂无可用数据"}</em></span>
          <span><b>到期预估</b><em>{dashboard.optionsExpiration ?? "暂不计算"}</em></span>
        </div>
        {!dashboard.optionsDate ? <div className="chart-empty">{dashboard.optionFreshness.status === "HISTORICAL" ? `${dashboard.optionFreshness.reason}。Gamma、墙位、最大痛点和期权估算区间已停用，等待同日快照更新。` : "这个代码暂时没有可用的期权数据"}</div> : <>
          <SectionPager label="期权持仓与波动" accent="var(--warning)" tabs={[
            { id: "options-range", label: "波动范围", content: <div className="options-visual-grid"><ExpectedRangeVisual close={dashboard.quote.close} lower={dashboard.options.expectedLower} upper={dashboard.options.expectedUpper} expectedMove={dashboard.options.expectedMove} expectedMovePct={dashboard.options.expectedMovePct} expiration={dashboard.optionsExpiration} maxPain={dashboard.options.maxPain} callWall={dashboard.options.callWall} putWall={dashboard.options.putWall} /><PutCallVisual ratio={dashboard.options.putCallOi} atmIv={dashboard.options.atmIv} /></div> },
            { id: "options-gamma", label: "Gamma偏向", content: <GammaExposureVisual {...dashboard.options.gammaExposure} /> },
            { id: "options-oi", label: "持仓分布", content: <><WallStrengthVisual call={dashboard.options.wallProfiles.call} put={dashboard.options.wallProfiles.put} /><div className="chart-panel oi-panel"><div className="chart-title"><div><h3><MetricLabel metric="openInterest">每个行权价有多少未结束合约</MetricLabel></h3><small>Call 向上、Put 向下；柱越长，合约越多</small></div><span><i className="call" />Call <i className="put" />Put</span></div><OptionOiChart data={dashboard.optionOpenInterest} change={dashboard.optionOpenInterestChange} /></div></> },
            { id: "options-history", label: "历史变化", content: <OptionStructureHistory history={dashboard.optionResearchHistory} /> },
          ]} />
        </>}
      </section>
      <Footer />
    </main>
  );
}
