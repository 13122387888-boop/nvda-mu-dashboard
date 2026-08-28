"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DayOverDayChips, type DayOverDayChange } from "@/components/day-over-day-change";
import { money, percent } from "@/lib/format";
import type { SupportedSymbol } from "@/lib/stocks";

type ScanCard = {
  symbol: SupportedSymbol;
  name: string;
  shortName: string;
  accent: string;
  assetType: "STOCK" | "ETF";
  close: number | null;
  dailyChangePct: number | null;
  trendScore: number | null;
  marketStatus: string;
  gammaRegime: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNAVAILABLE";
  attention: { label: string; detail: string; score: number; tone: "positive" | "negative" | "warning" | "neutral" };
  dayOverDay: DayOverDayChange | null;
  dataDate: string | null;
};

type Filter = "ALL" | "ETF" | "BULLISH" | "NEGATIVE_GAMMA";

const filters: Array<{ value: Filter; label: string }> = [
  { value: "ALL", label: "全部" },
  { value: "ETF", label: "ETF" },
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
  const etfCount = cards.filter((card) => card.assetType === "ETF").length;

  const visibleCards = useMemo(() => {
    const filtered = cards.filter((card) => {
      if (filter === "ETF") return card.assetType === "ETF";
      if (filter === "BULLISH") return card.trendScore !== null && card.trendScore >= 60;
      if (filter === "NEGATIVE_GAMMA") return card.gammaRegime === "NEGATIVE";
      return true;
    });
    return [...filtered].sort((a, b) => (b.trendScore ?? -1) - (a.trendScore ?? -1) || a.symbol.localeCompare(b.symbol));
  }, [cards, filter]);

  return (
    <section className="stock-scanner" aria-label="热门股票收盘扫描器">
      <div className="scanner-controls">
        <div className="scanner-filters" aria-label="筛选股票">
          {filters.map((item) => <button type="button" className={filter === item.value ? "active" : ""} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} key={item.value}>{item.label}</button>)}
        </div>
        <div className="scanner-market-line"><span><b>{bullishCount}</b> 个趋势偏多</span><span><b>{negativeGammaCount}</b> 个负 Gamma</span><span><b>{etfCount}</b> 只 ETF</span><i>趋势分由高到低</i></div>
      </div>

      <div className="scanner-table" aria-live="polite">
        <div className="scanner-head" aria-hidden="true"><span>股票</span><span>收盘表现</span><span>趋势分</span><span>期权结构</span><span>较昨日变化</span><span>日期</span><i /></div>
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
            <div className="scanner-change"><small>较昨日变化</small><div className="scanner-change-chips"><DayOverDayChips change={stock.dayOverDay} /></div><span>{stock.attention.label}</span></div>
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
