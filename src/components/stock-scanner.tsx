"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { money, percent, STATUS_LABELS } from "@/lib/format";
import type { SupportedSymbol } from "@/lib/stocks";

type ScanCard = {
  symbol: SupportedSymbol;
  name: string;
  shortName: string;
  accent: string;
  close: number | null;
  dailyChangePct: number | null;
  marketStatus: string;
  gammaRegime: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNAVAILABLE";
  attention: { label: string; detail: string; score: number; tone: "positive" | "negative" | "warning" | "neutral" };
  dataDate: string | null;
};

type Filter = "ALL" | "ATTENTION" | "BULLISH" | "NEGATIVE_GAMMA";
type Sort = "PRIORITY" | "CHANGE" | "SYMBOL";

const filters: Array<{ value: Filter; label: string }> = [
  { value: "ALL", label: "全部" },
  { value: "ATTENTION", label: "需要关注" },
  { value: "BULLISH", label: "偏多" },
  { value: "NEGATIVE_GAMMA", label: "负 Gamma" },
];

const gammaLabels = { POSITIVE: "正 Gamma", NEGATIVE: "负 Gamma", NEUTRAL: "Gamma 中性", UNAVAILABLE: "Gamma 暂无" } as const;

export function StockScanner({ cards }: { cards: ScanCard[] }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sort, setSort] = useState<Sort>("PRIORITY");
  const [prefetchSymbol, setPrefetchSymbol] = useState<SupportedSymbol | null>(null);
  const bullishCount = cards.filter((card) => card.marketStatus === "STRONG_BULLISH" || card.marketStatus === "BULLISH").length;
  const negativeGammaCount = cards.filter((card) => card.gammaRegime === "NEGATIVE").length;
  const attentionCount = cards.filter((card) => card.attention.score >= 60).length;
  const newestDate = cards.map((card) => card.dataDate).filter((date): date is string => Boolean(date)).sort().at(-1) ?? "等待同步";

  const visibleCards = useMemo(() => {
    const filtered = cards.filter((card) => {
      if (filter === "ATTENTION") return card.attention.score >= 60;
      if (filter === "BULLISH") return card.marketStatus === "STRONG_BULLISH" || card.marketStatus === "BULLISH";
      if (filter === "NEGATIVE_GAMMA") return card.gammaRegime === "NEGATIVE";
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sort === "CHANGE") return (b.dailyChangePct ?? -Infinity) - (a.dailyChangePct ?? -Infinity);
      if (sort === "SYMBOL") return a.symbol.localeCompare(b.symbol);
      return b.attention.score - a.attention.score || a.symbol.localeCompare(b.symbol);
    });
  }, [cards, filter, sort]);

  return (
    <section className="stock-scanner" aria-label="热门股票收盘扫描器">
      <div className="scanner-summary">
        <div><span>股票池</span><strong>{cards.length}</strong><small>当前覆盖</small></div>
        <div><span>需要关注</span><strong>{attentionCount}</strong><small>关键位 / 波动异常</small></div>
        <div><span>趋势偏多</span><strong>{bullishCount}</strong><small>基于均线结构</small></div>
        <div><span>负 Gamma</span><strong>{negativeGammaCount}</strong><small>波动放大代理</small></div>
        <div className="summary-date"><span>最新数据</span><strong>{newestDate}</strong><small>以各股票实际日期为准</small></div>
      </div>

      <div className="scanner-controls">
        <div className="scanner-filters" aria-label="筛选股票">
          {filters.map((item) => <button type="button" className={filter === item.value ? "active" : ""} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} key={item.value}>{item.label}</button>)}
        </div>
        <label>排序
          <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
            <option value="PRIORITY">关注优先</option>
            <option value="CHANGE">当日涨幅</option>
            <option value="SYMBOL">股票代码</option>
          </select>
        </label>
      </div>

      <div className="scanner-table" aria-live="polite">
        <div className="scanner-head" aria-hidden="true"><span>股票</span><span>收盘表现</span><span>趋势</span><span>期权结构</span><span>优先观察理由</span><span>日期</span><i /></div>
        {visibleCards.map((stock) => (
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
            <div className="scanner-signal"><small>趋势</small><b><i className={`status-dot ${stock.marketStatus.toLowerCase()}`} />{STATUS_LABELS[stock.marketStatus]}</b></div>
            <div className={`scanner-gamma ${stock.gammaRegime.toLowerCase()}`}><small>期权结构</small><b>{gammaLabels[stock.gammaRegime]}</b></div>
            <div className={`scanner-attention ${stock.attention.tone}`}><small>观察理由</small><b>{stock.attention.label}</b><span>{stock.attention.detail}</span></div>
            <time dateTime={stock.dataDate ?? undefined}>{stock.dataDate ?? "—"}</time>
            <i className="scanner-arrow" aria-hidden="true">→</i>
          </Link>
        ))}
        {!visibleCards.length && <div className="scanner-empty">当前筛选下没有符合条件的股票。</div>}
      </div>
      <footer><span>“需要关注”代表接近关键位、负 Gamma 或波动定价异常。</span><b>用于研究排序，不构成投资建议。</b></footer>
    </section>
  );
}
