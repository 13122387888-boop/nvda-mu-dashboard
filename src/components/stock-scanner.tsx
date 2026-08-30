"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DayOverDayChange } from "@/components/day-over-day-change";
import { TrendScoreExplanation } from "@/components/trend-score-explanation";
import { money, percent } from "@/lib/format";
import { isQuietStrength, isStructuralChange, sortCards } from "@/lib/home-scanner";
import type { TrendConfidence, TrendScoreBreakdown } from "@/lib/indicators/stock-metrics";
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
  trendBreakdown?: TrendScoreBreakdown | null;
  trendConfidence: TrendConfidence;
  relativeVolume: number | null;
  rsi14: number | null;
  maStructure: "BULLISH" | "BULLISH_PULLBACK" | "BEARISH" | "MIXED" | "UNAVAILABLE";
  bollinger: {
    middle: number | null;
    upper: number | null;
    lower: number | null;
    percentB: number | null;
    bandwidth: number | null;
    bandwidthPercentile: number | null;
    state: "SQUEEZE" | "WIDE" | "NORMAL" | "UNAVAILABLE";
    sampleSize: number;
  };
  ivPercentile: { percentile: number | null; sampleSize: number; label: string };
  marketStatus: string;
  gammaRegime: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNAVAILABLE";
  attention: { label: string; detail: string; score: number; tone: "positive" | "negative" | "warning" | "neutral" };
  dayOverDay: DayOverDayChange | null;
  dataDate: string | null;
};

type AssetFilter = "ALL" | "STOCK" | "ETF";
type SignalFilter = "BULLISH" | "VOLUME_CONFIRM" | "BOLL_SQUEEZE" | "NEGATIVE_GAMMA" | "QUIET_STRENGTH" | "STRUCTURAL_CHANGE";
type DistributionMode = "STOCK" | "OPTION";

const assetFilters: Array<{ value: AssetFilter; label: string }> = [
  { value: "ALL", label: "全部" },
  { value: "STOCK", label: "个股" },
  { value: "ETF", label: "ETF" },
];

const signalFilters: Array<{ value: SignalFilter; label: string }> = [
  { value: "BULLISH", label: "偏多" },
  { value: "VOLUME_CONFIRM", label: "量价共振" },
  { value: "BOLL_SQUEEZE", label: "BOLL 收口" },
  { value: "NEGATIVE_GAMMA", label: "负 Gamma" },
  { value: "QUIET_STRENGTH", label: "安静强势" },
  { value: "STRUCTURAL_CHANGE", label: "结构突变" },
];

const gammaLabels = { POSITIVE: "正 Gamma", NEGATIVE: "负 Gamma", NEUTRAL: "Gamma 中性", UNAVAILABLE: "Gamma 暂无" } as const;
const gammaShortLabels = { POSITIVE: "正 G", NEGATIVE: "负 G", NEUTRAL: "中性 G", UNAVAILABLE: "G 暂无" } as const;
const gammaTone = { POSITIVE: "stable", NEGATIVE: "amplify", NEUTRAL: "neutral", UNAVAILABLE: "unavailable" } as const;
const maStructureLabels = { BULLISH: "多头排列", BULLISH_PULLBACK: "强势回踩", BEARISH: "空头排列", MIXED: "均线混合", UNAVAILABLE: "均线暂无" } as const;

function trendPresentation(score: number | null) {
  if (score === null) return { label: "数据不足", tone: "insufficient_data" };
  if (score >= 75) return { label: "趋势强势", tone: "strong_bullish" };
  if (score >= 60) return { label: "趋势偏强", tone: "bullish" };
  if (score >= 40) return { label: "趋势中性", tone: "neutral" };
  if (score >= 25) return { label: "趋势偏弱", tone: "bearish" };
  return { label: "趋势弱势", tone: "bearish" };
}

function confidencePresentation(confidence: TrendConfidence) {
  if (confidence.level === "HIGH") return "长期完整";
  if (confidence.level === "MEDIUM") return "短中期";
  return "样本较少";
}

function matchesResearchSignal(card: ScanCard, signal: SignalFilter) {
  if (signal === "BULLISH") return card.trendScore !== null && card.trendScore >= 60;
  if (signal === "VOLUME_CONFIRM") {
    if (card.relativeVolume === null || card.relativeVolume < 1.5 || card.dailyChangePct === null || card.trendScore === null) return false;
    return (card.trendScore >= 60 && card.dailyChangePct > 0) || (card.trendScore <= 40 && card.dailyChangePct < 0);
  }
  if (signal === "BOLL_SQUEEZE") return card.bollinger.state === "SQUEEZE";
  if (signal === "NEGATIVE_GAMMA") return card.gammaRegime === "NEGATIVE";
  if (signal === "QUIET_STRENGTH") return isQuietStrength(card);
  return isStructuralChange(card);
}

function rsiPresentation(value: number | null) {
  if (value === null) return { label: "RSI 暂无", tone: "neutral" };
  if (value >= 70) return { label: `RSI ${value.toFixed(0)}偏热`, tone: "rsi-hot" };
  if (value >= 55) return { label: `RSI ${value.toFixed(0)}偏强`, tone: "rsi-strong" };
  if (value <= 30) return { label: `RSI ${value.toFixed(0)}偏冷`, tone: "rsi-cold" };
  if (value <= 45) return { label: `RSI ${value.toFixed(0)}偏弱`, tone: "rsi-weak" };
  return { label: `RSI ${value.toFixed(0)}中性`, tone: "neutral" };
}

function bollingerPosition(card: ScanCard) {
  const percentB = card.bollinger.percentB;
  if (percentB === null) return "BOLL 暂无";
  if (percentB >= 1) return "上轨外";
  if (percentB >= 0.75) return "上轨附近";
  if (percentB >= 0.5) return "中轨上方";
  if (percentB >= 0.25) return "中轨下方";
  if (percentB >= 0) return "下轨附近";
  return "下轨外";
}

function technicalStatus(card: ScanCard) {
  const rvol = card.relativeVolume;
  const percentB = card.bollinger.percentB;
  if (card.bollinger.state === "SQUEEZE") return { label: "BOLL 收口", tone: "neutral" as const };
  if (card.maStructure === "BULLISH" && rvol !== null && rvol >= 1.5 && (card.dailyChangePct ?? 0) > 0) return { label: "放量多头", tone: "positive" as const };
  if (card.maStructure === "BEARISH" && rvol !== null && rvol >= 1.5 && percentB !== null && percentB <= 0.25) return { label: "放量偏弱", tone: "negative" as const };
  if ((card.maStructure === "BULLISH" || card.maStructure === "BULLISH_PULLBACK") && percentB !== null && percentB < 0.5) return { label: "强势回踩", tone: "warning" as const };
  if (card.rsi14 !== null && card.rsi14 >= 70 && (rvol === null || rvol < 1.5)) return { label: "偏热待确认", tone: "warning" as const };
  if (rvol !== null && rvol <= 0.7) return { label: "成交偏淡", tone: "neutral" as const };
  return { label: card.attention.label, tone: card.attention.tone };
}

function TrendScoreSheet({ stock, onClose }: { stock: ScanCard | null; onClose: () => void }) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [active, setActive] = useState(false);

  const requestClose = useCallback(() => {
    setActive(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(onClose, 240);
  }, [onClose]);

  useEffect(() => {
    if (!stock) return;
    const previousOverflow = document.body.style.overflow;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      setActive(true);
      closeButtonRef.current?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
      if (event.key === "Tab") {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [requestClose, stock]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  if (!stock) return null;
  const breakdown = stock.trendBreakdown;
  const trend = trendPresentation(stock.trendScore);

  return createPortal(
    <div className={`metric-note-overlay trend-score-overlay ${active ? "active" : ""}`} onClick={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <section className="metric-note-sheet trend-score-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="metric-note-handle" aria-hidden="true" />
        <div className="metric-note-heading"><span>趋势分 · 计算备注</span><button ref={closeButtonRef} type="button" onClick={requestClose}>关闭</button></div>
        <div className="trend-score-sheet-title">
          <div><span>{stock.symbol}</span><h2 id={titleId}>这只标的的趋势分怎么来</h2></div>
          <div className="trend-score-sheet-total"><strong>{stock.trendScore ?? "—"}</strong><small>/100</small><span>{trend.label}</span></div>
        </div>
        {breakdown
          ? <TrendScoreExplanation breakdown={breakdown} />
          : <div className="trend-score-unavailable"><b>历史数据还不够</b><span>至少有两条可用均线后，才会显示趋势分组成。</span></div>}
      </section>
    </div>,
    document.body,
  );
}

function StructureDistribution({ cards }: { cards: ScanCard[] }) {
  const [mode, setMode] = useState<DistributionMode>("STOCK");
  const [selectedSymbol, setSelectedSymbol] = useState<SupportedSymbol | null>(null);
  const width = 720;
  const height = cards.length > 32 ? 380 : cards.length > 12 ? 320 : 292;
  const padding = { left: 52, right: 24, top: 30, bottom: 42 };
  const metricValue = (card: ScanCard) => mode === "OPTION"
    ? card.ivPercentile.percentile
    : card.bollinger.percentB === null ? null : card.bollinger.percentB * 100;
  const plotted = cards.filter((card) => card.trendScore !== null && metricValue(card) !== null);
  const unavailable = cards.filter((card) => card.trendScore === null || metricValue(card) === null);
  const dense = plotted.length > 12;
  const veryDense = plotted.length > 32;
  const x = (value: number) => padding.left + Math.max(0, Math.min(100, value)) / 100 * (width - padding.left - padding.right);
  const normalizedY = (value: number) => mode === "OPTION" ? value : ((Math.max(-20, Math.min(120, value)) + 20) / 140) * 100;
  const y = (value: number) => padding.top + (100 - normalizedY(value)) / 100 * (height - padding.top - padding.bottom);
  const radius = (value: number | null) => {
    if (value === null) return 4;
    const scaled = Math.sqrt(Math.max(0.5, Math.min(2.5, value)));
    const minimum = veryDense ? 7 : dense ? 9 : 12;
    const spread = veryDense ? 5 : dense ? 6 : 8;
    return minimum + (scaled - Math.sqrt(0.5)) / (Math.sqrt(2.5) - Math.sqrt(0.5)) * spread;
  };
  const pointClass = (card: ScanCard) => {
    if (mode === "OPTION") return card.gammaRegime === "POSITIVE" ? "stable" : card.gammaRegime === "NEGATIVE" ? "amplify" : "neutral";
    return rsiPresentation(card.rsi14).tone;
  };
  const positioned = plotted.reduce<Array<{ card: ScanCard; anchorX: number; anchorY: number; cx: number; cy: number; r: number }>>((placed, card) => {
    const anchorX = x(card.trendScore!);
    const anchorY = y(metricValue(card)!);
    const r = radius(card.relativeVolume);
    let cx = anchorX;
    let cy = anchorY;
    for (let attempt = 0; attempt < (veryDense ? 96 : 64); attempt += 1) {
      const distance = attempt === 0 ? 0 : 9 + Math.ceil(attempt / 8) * (veryDense ? 9 : 11);
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
  const selected = cards.find((card) => card.symbol === selectedSymbol) ?? null;
  const unavailableSummary = unavailable.length > 5
    ? `${unavailable.slice(0, 5).map((card) => card.symbol).join("、")} 等 ${unavailable.length} 个`
    : unavailable.map((card) => card.symbol).join("、");
  const quadrant = mode === "OPTION"
    ? { topLeft: "趋势弱 · 波动偏贵", topRight: "强势但波动偏贵", bottomLeft: "弱势且波动平静", bottomRight: "安静强势", axis: "IV 初步位置", top: "100", bottom: "0" }
    : { topLeft: "弱势结构 · 上轨附近", topRight: "强势结构 · 上轨附近", bottomLeft: "弱势结构 · 下轨附近", bottomRight: "强势结构 · 回踩区域", axis: "BOLL %B", top: "上轨外", bottom: "下轨外" };

  return (
    <section className="structure-distribution" aria-labelledby="structure-distribution-title">
      <div className="distribution-heading">
        <div><span>横向比较</span><h2 id="structure-distribution-title">结构分布</h2></div>
        <div className="distribution-heading-tools">
          <div className="distribution-mode-switch" aria-label="分布图观察模式">
            <button type="button" className={mode === "STOCK" ? "active" : ""} aria-pressed={mode === "STOCK"} onClick={() => { setMode("STOCK"); setSelectedSymbol(null); }}>股票观察</button>
            <button type="button" className={mode === "OPTION" ? "active" : ""} aria-pressed={mode === "OPTION"} onClick={() => { setMode("OPTION"); setSelectedSymbol(null); }}>期权观察</button>
          </div>
          <div className="distribution-legend">
            {mode === "OPTION" ? <><span><i className="stable" />正 Gamma</span><span><i className="amplify" />负 Gamma</span><span><i className="neutral" />中性 / 暂无</span></> : <><span><i className="rsi-hot" />RSI偏热</span><span><i className="rsi-strong" />RSI偏强</span><span><i className="rsi-weak" />RSI偏弱</span><span><i className="rsi-cold" />RSI偏冷</span><span><i className="neutral" />中性</span></>}
          </div>
        </div>
      </div>
      <div className="distribution-chart">
        {plotted.length ? <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={mode === "OPTION" ? "趋势分、IV位置、相对成交量和Gamma结构分布图" : "趋势分、布林位置、RSI状态和相对成交量分布图"}>
          <rect x={padding.left} y={padding.top} width={width - padding.left - padding.right} height={height - padding.top - padding.bottom} className="distribution-frame" />
          <line x1={x(50)} x2={x(50)} y1={padding.top} y2={height - padding.bottom} className="distribution-midline" />
          <line x1={padding.left} x2={width - padding.right} y1={y(50)} y2={y(50)} className="distribution-midline" />
          <text x={padding.left + 10} y={padding.top + 17}>{quadrant.topLeft}</text><text x={width - padding.right - 10} y={padding.top + 17} textAnchor="end">{quadrant.topRight}</text>
          <text x={padding.left + 10} y={height - padding.bottom - 10}>{quadrant.bottomLeft}</text><text x={width - padding.right - 10} y={height - padding.bottom - 10} textAnchor="end">{quadrant.bottomRight}</text>
          <text x={padding.left - 9} y={padding.top + 4} textAnchor="end">{quadrant.top}</text><text x={padding.left - 9} y={height - padding.bottom + 4} textAnchor="end">{quadrant.bottom}</text>
          <text x={padding.left} y={height - 11}>趋势分 0</text><text x={width - padding.right} y={height - 11} textAnchor="end">趋势分 100</text>
          <text x="12" y={height / 2} transform={`rotate(-90 12 ${height / 2})`} textAnchor="middle" className="distribution-axis-label">{quadrant.axis}</text>
          {positioned.map(({ card, anchorX, anchorY, cx, cy, r }) => {
            const displaced = Math.hypot(anchorX - cx, anchorY - cy) > 2;
            const isSelected = selectedSymbol === card.symbol;
            const bollingerMetric = card.bollinger.percentB === null ? "暂无" : `${(card.bollinger.percentB * 100).toFixed(0)}%`;
            const chartMetric = mode === "OPTION" ? `IV位置 ${card.ivPercentile.percentile}` : `BOLL位置 ${bollingerMetric}`;
            return <a
              href={`/stocks/${card.symbol}`}
              className={`distribution-point ${pointClass(card)}${isSelected ? " selected" : ""}`}
              key={card.symbol}
              aria-label={`${card.symbol} 趋势分 ${card.trendScore}，${chartMetric}，相对成交量 ${card.relativeVolume?.toFixed(1) ?? "暂无"}倍`}
              onClick={(event) => {
                if (!isSelected) {
                  event.preventDefault();
                  setSelectedSymbol(card.symbol);
                }
              }}
            >
              {displaced && <><line x1={anchorX} y1={anchorY} x2={cx} y2={cy} className="distribution-connector" /><circle cx={anchorX} cy={anchorY} r="2.5" className="distribution-anchor" /></>}
              <circle cx={cx} cy={cy} r={r} />
              <text x={cx} y={cy + 3} textAnchor="middle">{card.symbol}</text>
            </a>;
          })}
        </svg> : <div className="distribution-empty">当前筛选下缺少可比较的历史数据。</div>}
      </div>
      <div className={`distribution-readout${selected ? " active" : ""}`} aria-live="polite">
        {selected ? <>
          <div><b>{selected.symbol}</b><span>趋势 {selected.trendScore ?? "—"}</span>{mode === "OPTION" ? <span>{selected.ivPercentile.label}</span> : <><span>{maStructureLabels[selected.maStructure]}</span><span>{rsiPresentation(selected.rsi14).label}</span><span>{bollingerPosition(selected)}</span></>}<span>量能 {selected.relativeVolume?.toFixed(1) ?? "—"}×</span>{mode === "OPTION" && <span>{gammaLabels[selected.gammaRegime]}</span>}</div>
          <Link href={`/stocks/${selected.symbol}`}>查看详情 →</Link>
        </> : <span>点击气泡查看完整读数；再次点击同一气泡进入详情。</span>}
      </div>
      <footer>
        <span>{mode === "OPTION" ? "气泡面积＝相对成交量；量能缺失时显示最小圆点；IV位置少于20个快照时属于初步结论。" : "横轴＝趋势分；纵轴＝BOLL位置；面积＝相对成交量（缺失时为最小圆点）；颜色＝RSI状态。"}</span>
        <span>已绘制 {plotted.length}/{cards.length}{unavailable.length > 0 ? ` · 未入图：${unavailableSummary}` : ""}</span>
      </footer>
    </section>
  );
}

export function StockScanner({ cards }: { cards: ScanCard[] }) {
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("ALL");
  const [activeSignals, setActiveSignals] = useState<SignalFilter[]>([]);
  const [query, setQuery] = useState("");
  const [prefetchSymbol, setPrefetchSymbol] = useState<SupportedSymbol | null>(null);
  const [trendSheetSymbol, setTrendSheetSymbol] = useState<SupportedSymbol | null>(null);
  const closeTrendSheet = useCallback(() => setTrendSheetSymbol(null), []);
  const selectedTrendStock = cards.find((card) => card.symbol === trendSheetSymbol) ?? null;

  const assetCounts: Record<AssetFilter, number> = {
    ALL: cards.length,
    STOCK: cards.filter((card) => card.assetType === "STOCK").length,
    ETF: cards.filter((card) => card.assetType === "ETF").length,
  };
  const signalCounts = Object.fromEntries(signalFilters.map((item) => [item.value, cards.filter((card) => matchesResearchSignal(card, item.value)).length])) as Record<SignalFilter, number>;

  const visibleCards = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleUpperCase();
    const filtered = cards.filter((card) => {
      if (normalizedQuery && !`${card.symbol} ${card.name} ${card.shortName}`.toLocaleUpperCase().includes(normalizedQuery)) return false;
      if (assetFilter !== "ALL" && card.assetType !== assetFilter) return false;
      if (activeSignals.length && !activeSignals.some((signal) => matchesResearchSignal(card, signal))) return false;
      return true;
    });
    return sortCards(filtered, "TREND") as ScanCard[];
  }, [activeSignals, assetFilter, cards, query]);

  const toggleSignal = (signal: SignalFilter) => {
    setActiveSignals((current) => current.includes(signal) ? current.filter((item) => item !== signal) : [...current, signal]);
  };

  return (
    <section className="stock-scanner" aria-label="热门股票收盘扫描器">
      <div className="scanner-controls">
        <div className="scanner-filter-row">
          <div className="scanner-filter-groups">
            <div className="scanner-filter-group">
              <span className="scanner-filter-label">类型</span>
              <div className="scanner-filters scanner-asset-filters" aria-label="按标的类型筛选">
                {assetFilters.map((item) => <button type="button" className={assetFilter === item.value ? "active" : ""} aria-pressed={assetFilter === item.value} onClick={() => setAssetFilter(item.value)} key={item.value}><span>{item.label}</span><b>{assetCounts[item.value]}</b></button>)}
              </div>
            </div>
            <div className="scanner-filter-group">
              <span className="scanner-filter-label">信号</span>
              <div className="scanner-filters scanner-signal-filters" aria-label="按研究信号筛选，可多选且满足任一条件">
                {signalFilters.map((item) => <button type="button" className={activeSignals.includes(item.value) ? "active" : ""} aria-pressed={activeSignals.includes(item.value)} onClick={() => toggleSignal(item.value)} key={item.value}><span>{item.label}</span><b>{signalCounts[item.value]}</b></button>)}
              </div>
            </div>
          </div>
          <label className="scanner-search"><span>搜索</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="代码或名称" autoComplete="off" /></label>
        </div>
        <div className="scanner-toolbar">
          <div className="scanner-market-line"><span>显示 <b>{visibleCards.length}</b> / {cards.length}</span><i>趋势分由高到低</i></div>
        </div>
      </div>

      <div className="scanner-content">
        <StructureDistribution cards={visibleCards} />

        <div className="scanner-table" aria-live="polite">
          <div className="scanner-head" aria-hidden="true"><span>股票</span><span>收盘表现</span><span>趋势判断</span><span>期权结构</span><span>主要关注理由</span><span>日期</span><i /></div>
          {visibleCards.map((stock) => {
            const trend = trendPresentation(stock.trendScore);
            const technical = technicalStatus(stock);
            const showVolume = stock.relativeVolume !== null && (stock.relativeVolume >= 1.3 || stock.relativeVolume <= 0.7);
            return (
              <article
                className="scanner-row"
                style={{ "--accent": stock.accent } as React.CSSProperties}
                key={stock.symbol}
              >
                <Link
                  className="scanner-row-hitbox"
                  href={`/stocks/${stock.symbol}`}
                  prefetch={prefetchSymbol === stock.symbol ? null : false}
                  onMouseEnter={() => setPrefetchSymbol(stock.symbol)}
                  onFocus={() => setPrefetchSymbol(stock.symbol)}
                  aria-label={`查看 ${stock.symbol} 详情`}
                />
                <div className="scanner-stock"><b>{stock.symbol}</b><span>{stock.shortName}</span></div>
                <div className="scanner-price"><b>{money(stock.close)}</b><span className={stock.dailyChangePct !== null && stock.dailyChangePct >= 0 ? "positive" : "negative"}>{stock.dailyChangePct === null ? "等待同步" : `${stock.dailyChangePct >= 0 ? "+" : ""}${percent(stock.dailyChangePct, true)}`}</span></div>
                <button
                  type="button"
                  className="scanner-signal scanner-trend-trigger"
                  onClick={() => setTrendSheetSymbol(stock.symbol)}
                  aria-haspopup="dialog"
                  aria-expanded={trendSheetSymbol === stock.symbol}
                  aria-label={`${stock.symbol} 趋势分 ${stock.trendScore ?? "暂无"}，查看组成`}
                >
                  <small>趋势判断</small><strong>{stock.trendScore ?? "—"}</strong>
                  <b><i className={`status-dot ${trend.tone}`} />{trend.label}</b>
                  <span className="scanner-confidence" title={stock.trendConfidence.reason}>{confidencePresentation(stock.trendConfidence)}</span>
                  {showVolume && <em>量能 {stock.relativeVolume!.toFixed(1)}×</em>}
                  <span className={`scanner-mobile-gamma ${gammaTone[stock.gammaRegime]}`}>{gammaShortLabels[stock.gammaRegime]}</span>
                </button>
                <div className={`scanner-gamma ${gammaTone[stock.gammaRegime]}`}><small>期权结构</small><b>{gammaLabels[stock.gammaRegime]}</b><em>{stock.ivPercentile.label}</em></div>
                <div className="scanner-change">
                  <small>主要关注理由</small>
                  <strong className={`scanner-primary-reason ${technical.tone}`} title={`${maStructureLabels[stock.maStructure]} · ${rsiPresentation(stock.rsi14).label} · ${bollingerPosition(stock)} · ${stock.attention.detail}`}>{technical.label}</strong>
                </div>
                <time dateTime={stock.dataDate ?? undefined}>{stock.dataDate ?? "—"}</time>
                <i className="scanner-arrow" aria-hidden="true">→</i>
              </article>
            );
          })}
          {!visibleCards.length && <div className="scanner-empty">当前筛选或搜索下没有符合条件的标的。</div>}
        </div>
      </div>
      <footer><span>MA判断方向，RSI与BOLL描述短线状态，成交量只用于确认参与度；触及上下轨不等同于买卖信号。</span><b>用于研究排序，不构成投资建议。</b></footer>
      <TrendScoreSheet stock={selectedTrendStock} onClose={closeTrendSheet} />
    </section>
  );
}
