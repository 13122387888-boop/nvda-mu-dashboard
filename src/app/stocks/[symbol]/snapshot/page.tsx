import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { SnapshotActions, type SnapshotExportData } from "@/components/snapshot-actions";
import { Header } from "@/components/site-chrome";
import { buildResearchBrief } from "@/lib/indicators/decision-support";
import { money, number, percent, STATUS_LABELS } from "@/lib/format";
import { getStockDashboard, isSupportedSymbol, STOCKS } from "@/lib/services/stock-dashboard-service";

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }): Promise<Metadata> {
  const symbol = (await params).symbol.toUpperCase();
  if (!isSupportedSymbol(symbol)) return {};
  return {
    title: `${symbol} 研究快照`,
    description: `${STOCKS[symbol].name}的收盘趋势、近期波动和期权持仓摘要。`,
    openGraph: { title: `${symbol} 研究快照`, description: `${STOCKS[symbol].name}收盘研究摘要。`, images: [] },
    twitter: { card: "summary", title: `${symbol} 研究快照`, description: `${STOCKS[symbol].name}收盘研究摘要。`, images: [] },
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
  const exportData: SnapshotExportData = {
    symbol,
    name: dashboard.name,
    stockDate: dashboard.stockDate,
    optionsDate: dashboard.optionsDate,
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
        <header><div><span>研究快照</span><b>{symbol}</b><h1>{dashboard.name}</h1></div><div><small>股票数据 {dashboard.stockDate}</small><small>期权数据 {dashboard.optionsDate ?? "暂无"}</small><small>统计期限 {dashboard.optionWindowLabel}</small><small>区间对应到期日 {dashboard.optionsExpiration ?? "暂无"}</small></div></header>
        <div className="snapshot-quote"><strong>{money(dashboard.quote.close)}</strong><span className={change !== null && change >= 0 ? "positive" : "negative"}>{exportData.change}</span></div>
        <p className="snapshot-summary">{brief.summary}</p>
        <div className="snapshot-metrics">
          <article><span>大方向</span><strong>{STATUS_LABELS[dashboard.quote.marketStatus]}</strong><p>短线强弱（RSI）{number(dashboard.trend.rsi14, 1)} · 近20日实际波动 {percent(dashboard.trend.rv20)}</p></article>
          <article><span>期权预计波动</span><strong>{percent(dashboard.options.atmIv)}</strong><p>估算上下幅度 ±{percent(dashboard.options.expectedMovePct)}</p></article>
          <article><span>关键价位</span><strong>{money(dashboard.options.putWall)} – {money(dashboard.options.callWall)}</strong><p>看跌墙 – 看涨墙</p></article>
          <article><span>Gamma 偏向</span><strong>{gammaLabels[dashboard.options.gammaExposure.regime]}</strong><p>最近到期最大痛点 {money(dashboard.options.maxPain)}</p></article>
        </div>
        <footer><span>根据公开收盘数据整理，数据更新后会重新计算。</span><b>不构成投资建议</b></footer>
      </section>
    </main>
  );
}
