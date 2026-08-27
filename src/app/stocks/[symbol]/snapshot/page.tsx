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
    description: `${STOCKS[symbol].name}的日终趋势、波动率和期权结构研究快照。`,
    openGraph: { title: `${symbol} 研究快照`, description: `${STOCKS[symbol].name}日终研究快照。`, images: [] },
    twitter: { card: "summary", title: `${symbol} 研究快照`, description: `${STOCKS[symbol].name}日终研究快照。`, images: [] },
  };
}

const gammaLabels = { POSITIVE: "正 Gamma 代理", NEGATIVE: "负 Gamma 代理", NEUTRAL: "Gamma 中性", UNAVAILABLE: "数据不足" } as const;

export default async function SnapshotPage({ params, searchParams }: { params: Promise<{ symbol: string }>; searchParams: Promise<{ window?: string | string[] }> }) {
  const symbol = (await params).symbol.toUpperCase();
  if (!isSupportedSymbol(symbol)) notFound();
  const rawWindow = (await searchParams).window;
  const requestedWindow = typeof rawWindow === "string" ? rawWindow : null;
  await connection();
  const dashboard = await getStockDashboard(symbol, requestedWindow);
  if (!dashboard) notFound();
  const brief = buildResearchBrief({ marketStatus: dashboard.quote.marketStatus, rsi14: dashboard.trend.rsi14, rv20: dashboard.trend.rv20, atmIv: dashboard.options.atmIv, gammaRegime: dashboard.options.gammaExposure.regime });
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
    volatility: `RV20 ${percent(dashboard.trend.rv20)} / IV ${percent(dashboard.options.atmIv)}`,
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
        <header><div><span>研究快照</span><b>{symbol}</b><h1>{dashboard.name}</h1></div><div><small>股票数据 {dashboard.stockDate}</small><small>期权数据 {dashboard.optionsDate ?? "暂无"}</small><small>期限 {dashboard.optionWindowLabel}</small><small>定价到期 {dashboard.optionsExpiration ?? "暂无"}</small></div></header>
        <div className="snapshot-quote"><strong>{money(dashboard.quote.close)}</strong><span className={change !== null && change >= 0 ? "positive" : "negative"}>{exportData.change}</span></div>
        <p className="snapshot-summary">{brief.summary}</p>
        <div className="snapshot-metrics">
          <article><span>趋势</span><strong>{STATUS_LABELS[dashboard.quote.marketStatus]}</strong><p>RSI14 {number(dashboard.trend.rsi14, 1)} · RV20 {percent(dashboard.trend.rv20)}</p></article>
          <article><span>波动定价</span><strong>ATM IV {percent(dashboard.options.atmIv)}</strong><p>预期波动 ±{percent(dashboard.options.expectedMovePct)}</p></article>
          <article><span>关键价位</span><strong>{money(dashboard.options.putWall)} – {money(dashboard.options.callWall)}</strong><p>看跌墙 – 看涨墙</p></article>
          <article><span>期权结构</span><strong>{gammaLabels[dashboard.options.gammaExposure.regime]}</strong><p>最大痛点 {money(dashboard.options.maxPain)}</p></article>
        </div>
        <footer><span>基于公开日终数据的规则观察，数据变化后重新计算。</span><b>不构成投资建议</b></footer>
      </section>
    </main>
  );
}
