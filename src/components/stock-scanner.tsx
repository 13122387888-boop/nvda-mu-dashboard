"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { money, percent } from "@/lib/format";
import type { SupportedSymbol } from "@/lib/stocks";

type ScanCard = {
  symbol: SupportedSymbol;
  name: string;
  shortName: string;
  accent: string;
  close: number | null;
  dailyChangePct: number | null;
  trendScore: number | null;
  marketStatus: string;
  gammaRegime: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNAVAILABLE";
  attention: { label: string; detail: string; score: number; tone: "positive" | "negative" | "warning" | "neutral" };
  dataDate: string | null;
};

type Filter = "ALL" | "ATTENTION" | "BULLISH" | "NEGATIVE_GAMMA";

const filters: Array<{ value: Filter; label: string }> = [
  { value: "ALL", label: "全部" },
  { value: "ATTENTION", label: "需要关注" },
  { value: "BULLISH", label: "偏多" },
  { value: "NEGATIVE_GAMMA", label: "负 Gamma" },
];

const gammaLabels = { POSITIVE: "正 Gamma", NEGATIVE: "负 Gamma", NEUTRAL: "Gamma 中性", UNAVAILABLE: "Gamma 暂无" } as const;

function trendPresentation(score: number | null) {
  if (score === null) return { label: "数据不足", tone: "insufficient_data" };
  if (score >= 75) return { label: "趋势强势", tone: "strong_bullish" };
  if (score >= 60) return { label: "趋势偏强", tone: "bullish" };
  if (score >= 40) return { label: "趋势中性", tone: "neutral" };
  if (score >= 25) return { label: "趋势偏弱", tone: "bearish" };
  return { label: "趋势弱势", tone: "bearish" };
}

export function StockScanner({ cards }: { cards: ScanCard[] }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [prefetchSymbol, setPrefetchSymbol] = useState<SupportedSymbol | null>(null);
  const bullishCount = cards.filter((card) => card.trendScore !== null && card.trendScore >= 60).length;
  const negativeGammaCount = cards.filter((card) => card.gammaRegime === "NEGATIVE").length;
  const attentionCount = cards.filter((card) => card.attention.score >= 60).length;
  const newestDate = cards.map((card) => card.dataDate).filter((date): date is string => Boolean(date)).sort().at(-1) ?? "等待同步";

  const visibleCards = useMemo(() => {
    const filtered = cards.filter((card) => {
      if (filter === "ATTENTION") return card.attention.score >= 60;
      if (filter === "BULLISH") return card.trendScore !== null && card.trendScore >= 60;
      if (filter === "NEGATIVE_GAMMA") return card.gammaRegime === "NEGATIVE";
      return true;
    });
    return [...filtered].sort((a, b) => (b.trendScore ?? -1) - (a.trendScore ?? -1) || a.symbol.localeCompare(b.symbol));
  }, [cards, filter]);

  return (
    <section className="stock-scanner" aria-label="热门股票收盘扫描器">
      <div className="scanner-summary">
        <div><span>需要关注</span><strong>{attentionCount}</strong><small>关键位 / 波动异常</small></div>
        <div><span>趋势偏多</span><strong>{bullishCount}</strong><small>基于均线结构</small></div>
        <div><span>负 Gamma</span><strong>{negativeGammaCount}</strong><small>波动放大代理</small></div>
        <div className="summary-date"><span>最新数据</span><strong>{newestDate}</strong><small>以各股票实际日期为准</small></div>
      </div>

      <div className="scanner-controls">
        <div className="scanner-filters" aria-label="筛选股票">
          {filters.map((item) => <button type="button" className={filter === item.value ? "active" : ""} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} key={item.value}>{item.label}</button>)}
        </div>
        <span className="scanner-sort-note">趋势分由高到低</span>
      </div>

      <div className="scanner-table" aria-live="polite">
        <div className="scanner-head" aria-hidden="true"><span>股票</span><span>收盘表现</span><span>趋势分</span><span>期权结构</span><span>优先观察理由</span><span>日期</span><i /></div>
        {visibleCards.map((stock) => {
          const trend = trendPresentation(stock.trendScore);
          return (
          <Link
            className="scanner-row"
            href={`/stocks/${stock.symbol}`}
            prefetch={prefetchSymbol === stock.symbol ? null : false}
            onMouseEnter={() => setPrefetchSymbol(stock.symbol)}
            onFocus={() => setPrefetchSymbol(stock.symbol)}
            style={{ "--accent": stock.accent } as React.CSSProperties}
            key={stock.symbol}
          >
            <div className="scanner-stock"><b>{stock.symbol}</b><span>{stock.shortName}</span></div>
            <div className="scanner-price"><b>{money(stock.close)}</b><span className={stock.dailyChangePct !== null && stock.dailyChangePct >= 0 ? "positive" : "negative"}>{stock.dailyChangePct === null ? "等待同步" : `${stock.dailyChangePct >= 0 ? "+" : ""}${percent(stock.dailyChangePct, true)}`}</span></div>
            <div className="scanner-signal"><small>趋势分</small><strong>{stock.trendScore ?? "—"}</strong><b><i className={`status-dot ${trend.tone}`} />{trend.label}</b></div>
            <div className={`scanner-gamma ${stock.gammaRegime.toLowerCase()}`}><small>期权结构</small><b>{gammaLabels[stock.gammaRegime]}</b></div>
            <div className={`scanner-attention ${stock.attention.tone}`}><small>观察理由</small><b>{stock.attention.label}</b><span><i className="mobile-gamma">{gammaLabels[stock.gammaRegime]}</i>{stock.attention.detail}</span></div>
            <time dateTime={stock.dataDate ?? undefined}>{stock.dataDate ?? "—"}</time>
            <i className="scanner-arrow" aria-hidden="true">→</i>
          </Link>
          );
        })}
        {!visibleCards.length && <div className="scanner-empty">当前筛选下没有符合条件的股票。</div>}
      </div>
      <footer><span>趋势分：现价相对 20 / 50 / 200 日均线、均线排列与 RSI 综合量化；0 偏弱，100 偏强。</span><b>用于研究排序，不构成投资建议。</b></footer>
    </section>
  );
}
