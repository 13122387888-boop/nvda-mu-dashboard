import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { SnapshotActions, type SnapshotExportData } from "@/components/snapshot-actions";
import { Header } from "@/components/site-chrome";
import { buildResearchBrief } from "@/lib/indicators/decision-support";
import { money, number, percent, STATUS_LABELS } from "@/lib/format";
import { SITE_NAME } from "@/lib/site";
import { getStockDashboard, isSupportedSymbol, STOCKS } from "@/lib/services/stock-dashboard-service";

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }): Promise<Metadata> {
  const symbol = (await params).symbol.toUpperCase();
  if (!isSupportedSymbol(symbol)) return {};
  return {
    title: `${symbol} 研究快照`,
    description: `${STOCKS[symbol].name}的收盘趋势、近期波动和期权持仓摘要。`,
    alternates: { canonical: `/stocks/${symbol}/snapshot` },
    openGraph: {
      title: `${symbol} 研究快照 · ${SITE_NAME}`,
      description: `${STOCKS[symbol].name}收盘趋势、波动和期权结构摘要。`,
      url: `/stocks/${symbol}/snapshot`,
      siteName: SITE_NAME,
      images: [{ url: "/og-v2.jpg", width: 1200, height: 630, alt: `${symbol} ${SITE_NAME}研究快照` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${symbol} 研究快照 · ${SITE_NAME}`,
      description: `${STOCKS[symbol].name}收盘趋势、波动和期权结构摘要。`,
      images: ["/og-v2.jpg"],
    },
  };
}

const gammaLabels = { POSITIVE: "Gamma 正值（Call侧较大）", NEGATIVE: "Gamma 负值（Put侧较大）", NEUTRAL: "Gamma 两侧接近", UNAVAILABLE: "Gamma 数据不足" } as const;

export default async function SnapshotPage({ params, searchParams }: { params: Promise<{ symbol: string }>; searchParams: Promise<{ window?: string | string[] }> }) {
  const symbol = (await params).symbol.toUpperCase();
  if (!isSupportedSymbol(symbol)) notFound();
  const rawWindow = (await searchParams).window;
  const requestedWindow = typeof rawWindow === "string" ? rawWindow : null;
  await connection();
  const dashboard = await getStockDashboard(symbol, requestedWindow);
  if (!dashboard) notFound();
  const brief = buildResearchBrief({
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
    atmIv: dashboard.options.atmIv,
    gammaRegime: dashboard.options.gammaExposure.regime,
  });
  const change = dashboard.quote.dailyChangePct;
  const optionCurrent = dashboard.optionFreshness.isCurrent;
  const optionDateLabel = optionCurrent
    ? dashboard.optionsDate
    : dashboard.optionFreshness.status === "HISTORICAL"
      ? `${dashboard.optionsSnapshotDate}（历史快照，不用于当前结论）`
      : null;
  const exportData: SnapshotExportData = {
    symbol,
    name: dashboard.name,
    stockDate: dashboard.stockDate,
    optionsDate: optionDateLabel,
    expiration: dashboard.optionsExpiration,
    optionWindow: dashboard.optionWindowLabel,
    close: money(dashboard.quote.close),
    change: change === null ? "—" : `${change >= 0 ? "+" : ""}${percent(change, true)}`,
    summary: brief.summary,
    trend: STATUS_LABELS[dashboard.quote.marketStatus],
    rsi: number(dashboard.trend.rsi14, 1),
    volatility: `近20日实际波动 ${percent(dashboard.trend.rv20)} / 期权预估波动 ${percent(dashboard.options.atmIv)}`,
    expectedRange: dashboard.options.expectedLower === null || dashboard.options.expectedUpper === null ? "暂无" : `${money(dashboard.options.expectedLower)}–${money(dashboard.options.expectedUpper)}`,
    callWall: money(dashboard.options.callWall),
    putWall: money(dashboard.options.putWall),
    gamma: gammaLabels[dashboard.options.gammaExposure.regime],
  };
  const backQuery = dashboard.optionWindow === "ALL" ? "" : `?window=${dashboard.optionWindow}`;
  return (
    <main className="shell snapshot-page">
      <Header />
      <div className="snapshot-toolbar"><Link href={`/stocks/${symbol}${backQuery}`}>← 返回完整研究页</Link><SnapshotActions data={exportData} /></div>
      <section className="snapshot-card" aria-label={`${symbol} 研究快照`}>
        <header><div><span>研究快照</span><b>{symbol}</b><h1>{dashboard.name}</h1></div><div><small>股票数据 {dashboard.stockDate}</small><small>期权数据 {optionDateLabel ?? "暂无"}</small><small>统计期限 {optionCurrent ? dashboard.optionWindowLabel : "暂不计算"}</small><small>区间对应到期日 {dashboard.optionsExpiration ?? "暂无"}</small></div></header>
        <div className="snapshot-quote"><strong>{money(dashboard.quote.close)}</strong><span className={change !== null && change >= 0 ? "positive" : "negative"}>{exportData.change}</span></div>
        {dashboard.optionFreshness.status === "HISTORICAL" && <div className="stale-data-alert"><b>期权仅有历史快照</b><span>{dashboard.optionFreshness.reason}，Gamma、墙位、最大痛点和预期区间未作为当前结论展示。</span></div>}
        <p className="snapshot-summary">{brief.summary}</p>
        <div className="snapshot-metrics">
          <article><span>大方向</span><strong>{STATUS_LABELS[dashboard.quote.marketStatus]}</strong><p>短线强弱（RSI）{number(dashboard.trend.rsi14, 1)} · 近20日实际波动 {percent(dashboard.trend.rv20)}</p></article>
          <article><span>期权预计波动</span><strong>{optionCurrent ? percent(dashboard.options.atmIv) : "暂不计算"}</strong><p>{optionCurrent ? `估算上下幅度 ±${percent(dashboard.options.expectedMovePct)}` : "等待与股票同日的期权快照"}</p></article>
          <article><span>关键价位</span><strong>{optionCurrent ? `${money(dashboard.options.putWall)} – ${money(dashboard.options.callWall)}` : "暂不计算"}</strong><p>{optionCurrent ? "看跌墙 – 看涨墙" : "历史墙位未作为当前关键位"}</p></article>
          <article><span>Gamma 偏向</span><strong>{optionCurrent ? gammaLabels[dashboard.options.gammaExposure.regime] : "暂不计算"}</strong><p>{optionCurrent ? `最近到期最大痛点 ${money(dashboard.options.maxPain)}` : "历史 Gamma 与最大痛点已停用"}</p></article>
        </div>
        <footer><span>根据公开收盘数据整理，数据更新后会重新计算。</span><b>不构成投资建议</b></footer>
      </section>
    </main>
  );
}
