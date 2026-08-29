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
  relativeVolume: number | null;
  ivPercentile: { percentile: number | null; sampleSize: number; label: string };
  marketStatus: string;
  gammaRegime: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNAVAILABLE";
  attention: { label: string; detail: string; score: number; tone: "positive" | "negative" | "warning" | "neutral" };
  dayOverDay: DayOverDayChange | null;
  dataDate: string | null;
};

type Filter = "ALL" | "STOCK" | "ETF" | "BULLISH" | "NEGATIVE_GAMMA";

const filters: Array<{ value: Filter; label: string }> = [
  { value: "ALL", label: "全部" },
  { value: "STOCK", label: "个股" },
  { value: "ETF", label: "ETF" },
  { value: "BULLISH", label: "偏多" },
  { value: "NEGATIVE_GAMMA", label: "负 Gamma" },
];

const gammaLabels = { POSITIVE: "正 Gamma", NEGATIVE: "负 Gamma", NEUTRAL: "Gamma 中性", UNAVAILABLE: "Gamma 暂无" } as const;
const gammaTone = { POSITIVE: "stable", NEGATIVE: "amplify", NEUTRAL: "neutral", UNAVAILABLE: "unavailable" } as const;

function trendPresentation(score: number | null) {
  if (score === null) return { label: "数据不足", tone: "insufficient_data" };
  if (score >= 75) return { label: "趋势强势", tone: "strong_bullish" };
  if (score >= 60) return { label: "趋势偏强", tone: "bullish" };
  if (score >= 40) return { label: "趋势中性", tone: "neutral" };
  if (score >= 25) return { label: "趋势偏弱", tone: "bearish" };
  return { label: "趋势弱势", tone: "bearish" };
}

function StructureDistribution({ cards }: { cards: ScanCard[] }) {
  const width = 720;
  const dense = cards.length > 12;
  const height = dense ? 340 : 300;
  const padding = { left: 52, right: 24, top: 30, bottom: 42 };
  const plotted = cards.filter((card) => card.trendScore !== null && card.ivPercentile.percentile !== null);
  const unavailable = cards.filter((card) => card.ivPercentile.percentile === null);
  const x = (value: number) => padding.left + Math.max(0, Math.min(100, value)) / 100 * (width - padding.left - padding.right);
  const y = (value: number) => padding.top + (100 - Math.max(0, Math.min(100, value))) / 100 * (height - padding.top - padding.bottom);
  const radius = (value: number | null) => {
    const scaled = Math.sqrt(Math.max(0.5, Math.min(2.5, value ?? 1)));
    const minimum = dense ? 10 : 13;
    const spread = dense ? 7 : 9;
    return minimum + (scaled - Math.sqrt(0.5)) / (Math.sqrt(2.5) - Math.sqrt(0.5)) * spread;
  };
  const gammaClass = (regime: ScanCard["gammaRegime"]) => regime === "POSITIVE" ? "stable" : regime === "NEGATIVE" ? "amplify" : "neutral";
  const positioned = plotted.reduce<Array<{ card: ScanCard; anchorX: number; anchorY: number; cx: number; cy: number; r: number }>>((placed, card) => {
    const anchorX = x(card.trendScore!);
    const anchorY = y(card.ivPercentile.percentile!);
    const r = radius(card.relativeVolume);
    let cx = anchorX;
    let cy = anchorY;
    for (let attempt = 0; attempt < 64; attempt += 1) {
      const distance = attempt === 0 ? 0 : 11 + Math.ceil(attempt / 8) * 12;
      const angle = (attempt % 8) * Math.PI / 4;
      const candidateX = Math.max(padding.left + r, Math.min(width - padding.right - r, anchorX + Math.cos(angle) * distance));
      const candidateY = Math.max(padding.top + r, Math.min(height - padding.bottom - r, anchorY + Math.sin(angle) * distance));
      if (placed.every((point) => Math.hypot(point.cx - candidateX, point.cy - candidateY) >= point.r + r + 3)) {
        cx = candidateX;
        cy = candidateY;
        break;
      }
    }
    return [...placed, { card, anchorX, anchorY, cx, cy, r }];
  }, []);
  const unavailableSummary = unavailable.length > 6
    ? `${unavailable.slice(0, 6).map((card) => card.symbol).join("、")} 等 ${unavailable.length} 个`
    : unavailable.map((card) => card.symbol).join("、");

  return (
    <section className="structure-distribution" aria-labelledby="structure-distribution-title">
      <div className="distribution-heading">
        <div><span>横向比较</span><h2 id="structure-distribution-title">结构分布</h2></div>
        <div className="distribution-legend"><span><i className="stable" />正 Gamma · 偏稳定</span><span><i className="amplify" />负 Gamma · 易放大</span><span><i className="neutral" />中性 / 暂无</span></div>
      </div>
      <div className="distribution-chart">
        {plotted.length ? <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="股票趋势分、IV百分位、相对成交量和Gamma结构分布图">
          <rect x={padding.left} y={padding.top} width={width - padding.left - padding.right} height={height - padding.top - padding.bottom} className="distribution-frame" />
          <line x1={x(50)} x2={x(50)} y1={padding.top} y2={height - padding.bottom} className="distribution-midline" />
          <line x1={padding.left} x2={width - padding.right} y1={y(50)} y2={y(50)} className="distribution-midline" />
          <text x={padding.left + 10} y={padding.top + 17}>趋势弱 · IV高位</text><text x={width - padding.right - 10} y={padding.top + 17} textAnchor="end">趋势强 · IV高位</text>
          <text x={padding.left + 10} y={height - padding.bottom - 10}>趋势弱 · IV低位</text><text x={width - padding.right - 10} y={height - padding.bottom - 10} textAnchor="end">趋势强 · IV低位</text>
          <text x={padding.left - 9} y={padding.top + 4} textAnchor="end">100</text><text x={padding.left - 9} y={height - padding.bottom + 4} textAnchor="end">0</text>
          <text x={padding.left} y={height - 11}>趋势分 0</text><text x={width - padding.right} y={height - 11} textAnchor="end">趋势分 100</text>
          <text x="12" y={height / 2} transform={`rotate(-90 12 ${height / 2})`} textAnchor="middle" className="distribution-axis-label">IV 百分位</text>
          {positioned.map(({ card, anchorX, anchorY, cx, cy, r }) => {
            const displaced = Math.hypot(anchorX - cx, anchorY - cy) > 2;
            return <a href={`/stocks/${card.symbol}`} className={`distribution-point ${gammaClass(card.gammaRegime)}`} key={card.symbol} aria-label={`${card.symbol} 趋势分 ${card.trendScore}，IV百分位 ${card.ivPercentile.percentile}，相对成交量 ${card.relativeVolume?.toFixed(1) ?? "暂无"}倍`}>{displaced && <><line x1={anchorX} y1={anchorY} x2={cx} y2={cy} className="distribution-connector" /><circle cx={anchorX} cy={anchorY} r="2.5" className="distribution-anchor" /></>}<circle cx={cx} cy={cy} r={r} /><text x={cx} y={cy + 3} textAnchor="middle">{card.symbol}</text></a>;
          })}
        </svg> : <div className="distribution-empty">IV 历史样本正在积累，暂时没有可比较点位。</div>}
      </div>
      <footer><span>气泡面积＝相对成交量；IV 百分位使用最多 60 个日终期权快照；筛选与搜索同时作用于图和列表。</span>{unavailable.length > 0 && <span>IV 样本不足：{unavailableSummary}</span>}</footer>
    </section>
  );
}

export function StockScanner({ cards }: { cards: ScanCard[] }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [prefetchSymbol, setPrefetchSymbol] = useState<SupportedSymbol | null>(null);
  const bullishCount = cards.filter((card) => card.trendScore !== null && card.trendScore >= 60).length;
  const negativeGammaCount = cards.filter((card) => card.gammaRegime === "NEGATIVE").length;
  const stockCount = cards.filter((card) => card.assetType === "STOCK").length;
  const etfCount = cards.filter((card) => card.assetType === "ETF").length;
  const filterCounts: Record<Filter, number> = {
    ALL: cards.length,
    STOCK: stockCount,
    ETF: etfCount,
    BULLISH: bullishCount,
    NEGATIVE_GAMMA: negativeGammaCount,
  };

  const visibleCards = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleUpperCase();
    const filtered = cards.filter((card) => {
      if (normalizedQuery && !`${card.symbol} ${card.name} ${card.shortName}`.toLocaleUpperCase().includes(normalizedQuery)) return false;
      if (filter === "STOCK") return card.assetType === "STOCK";
      if (filter === "ETF") return card.assetType === "ETF";
      if (filter === "BULLISH") return card.trendScore !== null && card.trendScore >= 60;
      if (filter === "NEGATIVE_GAMMA") return card.gammaRegime === "NEGATIVE";
      return true;
    });
    return [...filtered].sort((a, b) => (b.trendScore ?? -1) - (a.trendScore ?? -1) || a.symbol.localeCompare(b.symbol));
  }, [cards, filter, query]);

  return (
    <section className="stock-scanner" aria-label="热门股票收盘扫描器">
      <div className="scanner-controls">
        <div className="scanner-filter-row">
          <div className="scanner-filters" aria-label="筛选股票">
            {filters.map((item) => <button type="button" className={filter === item.value ? "active" : ""} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} key={item.value}><span>{item.label}</span><b>{filterCounts[item.value]}</b></button>)}
          </div>
          <label className="scanner-search"><span>搜索</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="代码或名称" autoComplete="off" /></label>
        </div>
        <div className="scanner-market-line"><span>显示 <b>{visibleCards.length}</b> / {cards.length}</span><span><b>{bullishCount}</b> 个趋势偏多</span><span><b>{negativeGammaCount}</b> 个负 Gamma</span><i>趋势分由高到低</i></div>
      </div>

      <StructureDistribution cards={visibleCards} />

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
            <div className="scanner-signal"><small>趋势分</small><strong>{stock.trendScore ?? "—"}</strong><b><i className={`status-dot ${trend.tone}`} />{trend.label}</b>{stock.relativeVolume !== null && <em>量能 {stock.relativeVolume.toFixed(1)}×</em>}</div>
            <div className={`scanner-gamma ${gammaTone[stock.gammaRegime]}`}><small>期权结构</small><b>{gammaLabels[stock.gammaRegime]}</b></div>
            <div className="scanner-change"><small>较昨日变化</small><div className="scanner-change-chips"><DayOverDayChips change={stock.dayOverDay} compact /></div><span>{stock.attention.label}</span></div>
            <time dateTime={stock.dataDate ?? undefined}>{stock.dataDate ?? "—"}</time>
            <i className="scanner-arrow" aria-hidden="true">→</i>
          </Link>
          );
        })}
        {!visibleCards.length && <div className="scanner-empty">当前筛选或搜索下没有符合条件的标的。</div>}
      </div>
      <footer><span>趋势分：现价相对 20 / 50 / 200 日均线、均线排列与 RSI 综合量化；0 偏弱，100 偏强。</span><b>用于研究排序，不构成投资建议。</b></footer>
    </section>
  );
}
