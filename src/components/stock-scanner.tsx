"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { dayOverDayItems, type DayOverDayChange } from "@/components/day-over-day-change";
import { money, percent } from "@/lib/format";
import { isQuietStrength, isStructuralChange, sortCards } from "@/lib/home-scanner";
import type { TrendConfidence } from "@/lib/indicators/stock-metrics";
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
  trendConfidence: TrendConfidence;
  relativeVolume: number | null;
  ivPercentile: { percentile: number | null; sampleSize: number; label: string };
  marketStatus: string;
  gammaRegime: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNAVAILABLE";
  attention: { label: string; detail: string; score: number; tone: "positive" | "negative" | "warning" | "neutral" };
  dayOverDay: DayOverDayChange | null;
  dataDate: string | null;
};

type AssetFilter = "ALL" | "STOCK" | "ETF";
type SignalFilter = "BULLISH" | "NEGATIVE_GAMMA" | "QUIET_STRENGTH" | "STRUCTURAL_CHANGE";
type SortMode = "TREND" | "CHANGE";
type MobileView = "LIST" | "MAP";
type DistributionMode = "STOCK" | "OPTION";

const assetFilters: Array<{ value: AssetFilter; label: string }> = [
  { value: "ALL", label: "全部" },
  { value: "STOCK", label: "个股" },
  { value: "ETF", label: "ETF" },
];

const signalFilters: Array<{ value: SignalFilter; label: string }> = [
  { value: "BULLISH", label: "偏多" },
  { value: "NEGATIVE_GAMMA", label: "负 Gamma" },
  { value: "QUIET_STRENGTH", label: "安静强势" },
  { value: "STRUCTURAL_CHANGE", label: "结构突变" },
];

const gammaLabels = { POSITIVE: "正 Gamma", NEGATIVE: "负 Gamma", NEUTRAL: "Gamma 中性", UNAVAILABLE: "Gamma 暂无" } as const;
const gammaShortLabels = { POSITIVE: "正 G", NEGATIVE: "负 G", NEUTRAL: "中性 G", UNAVAILABLE: "G 暂无" } as const;
const gammaTone = { POSITIVE: "stable", NEGATIVE: "amplify", NEUTRAL: "neutral", UNAVAILABLE: "unavailable" } as const;

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
  if (signal === "NEGATIVE_GAMMA") return card.gammaRegime === "NEGATIVE";
  if (signal === "QUIET_STRENGTH") return isQuietStrength(card);
  return isStructuralChange(card);
}

function meaningfulChangeItems(change: DayOverDayChange | null) {
  return dayOverDayItems(change).filter((item) =>
    !item.label.includes("暂无") &&
    !item.label.includes("未变") &&
    item.label !== "处于昨日预期区间内",
  );
}

function StructureDistribution({ cards }: { cards: ScanCard[] }) {
  const [mode, setMode] = useState<DistributionMode>("STOCK");
  const [selectedSymbol, setSelectedSymbol] = useState<SupportedSymbol | null>(null);
  const width = 720;
  const height = cards.length > 12 ? 320 : 292;
  const padding = { left: 52, right: 24, top: 30, bottom: 42 };
  const metricValue = (card: ScanCard) => mode === "OPTION"
    ? card.ivPercentile.percentile
    : card.dayOverDay?.trendScoreDelta ?? null;
  const plotted = cards.filter((card) => card.trendScore !== null && metricValue(card) !== null);
  const unavailable = cards.filter((card) => card.trendScore === null || metricValue(card) === null);
  const dense = plotted.length > 12;
  const x = (value: number) => padding.left + Math.max(0, Math.min(100, value)) / 100 * (width - padding.left - padding.right);
  const normalizedY = (value: number) => mode === "OPTION" ? value : ((Math.max(-30, Math.min(30, value)) + 30) / 60) * 100;
  const y = (value: number) => padding.top + (100 - normalizedY(value)) / 100 * (height - padding.top - padding.bottom);
  const radius = (value: number | null) => {
    const scaled = Math.sqrt(Math.max(0.5, Math.min(2.5, value ?? 1)));
    const minimum = dense ? 9 : 12;
    const spread = dense ? 6 : 8;
    return minimum + (scaled - Math.sqrt(0.5)) / (Math.sqrt(2.5) - Math.sqrt(0.5)) * spread;
  };
  const pointClass = (card: ScanCard) => {
    if (mode === "OPTION") return card.gammaRegime === "POSITIVE" ? "stable" : card.gammaRegime === "NEGATIVE" ? "amplify" : "neutral";
    const delta = card.dayOverDay?.trendScoreDelta ?? 0;
    return delta > 0 ? "improve" : delta < 0 ? "weaken" : "neutral";
  };
  const positioned = plotted.reduce<Array<{ card: ScanCard; anchorX: number; anchorY: number; cx: number; cy: number; r: number }>>((placed, card) => {
    const anchorX = x(card.trendScore!);
    const anchorY = y(metricValue(card)!);
    const r = radius(card.relativeVolume);
    let cx = anchorX;
    let cy = anchorY;
    for (let attempt = 0; attempt < 64; attempt += 1) {
      const distance = attempt === 0 ? 0 : 10 + Math.ceil(attempt / 8) * 11;
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
    : { topLeft: "弱势但正在改善", topRight: "强势继续改善", bottomLeft: "弱势继续转差", bottomRight: "强势但正在转弱", axis: "趋势分日变化", top: "+30", bottom: "-30" };

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
            {mode === "OPTION" ? <><span><i className="stable" />正 Gamma</span><span><i className="amplify" />负 Gamma</span><span><i className="neutral" />中性 / 暂无</span></> : <><span><i className="improve" />趋势改善</span><span><i className="weaken" />趋势转弱</span><span><i className="neutral" />变化不大</span></>}
          </div>
        </div>
      </div>
      <div className="distribution-chart">
        {plotted.length ? <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={mode === "OPTION" ? "趋势分、IV位置、相对成交量和Gamma结构分布图" : "趋势分、趋势日变化和相对成交量分布图"}>
          <rect x={padding.left} y={padding.top} width={width - padding.left - padding.right} height={height - padding.top - padding.bottom} className="distribution-frame" />
          <line x1={x(50)} x2={x(50)} y1={padding.top} y2={height - padding.bottom} className="distribution-midline" />
          <line x1={padding.left} x2={width - padding.right} y1={y(mode === "OPTION" ? 50 : 0)} y2={y(mode === "OPTION" ? 50 : 0)} className="distribution-midline" />
          <text x={padding.left + 10} y={padding.top + 17}>{quadrant.topLeft}</text><text x={width - padding.right - 10} y={padding.top + 17} textAnchor="end">{quadrant.topRight}</text>
          <text x={padding.left + 10} y={height - padding.bottom - 10}>{quadrant.bottomLeft}</text><text x={width - padding.right - 10} y={height - padding.bottom - 10} textAnchor="end">{quadrant.bottomRight}</text>
          <text x={padding.left - 9} y={padding.top + 4} textAnchor="end">{quadrant.top}</text><text x={padding.left - 9} y={height - padding.bottom + 4} textAnchor="end">{quadrant.bottom}</text>
          <text x={padding.left} y={height - 11}>趋势分 0</text><text x={width - padding.right} y={height - 11} textAnchor="end">趋势分 100</text>
          <text x="12" y={height / 2} transform={`rotate(-90 12 ${height / 2})`} textAnchor="middle" className="distribution-axis-label">{quadrant.axis}</text>
          {positioned.map(({ card, anchorX, anchorY, cx, cy, r }) => {
            const displaced = Math.hypot(anchorX - cx, anchorY - cy) > 2;
            const isSelected = selectedSymbol === card.symbol;
            const chartMetric = mode === "OPTION" ? `IV位置 ${card.ivPercentile.percentile}` : `趋势变化 ${card.dayOverDay?.trendScoreDelta}`;
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
          <div><b>{selected.symbol}</b><span>趋势 {selected.trendScore ?? "—"}</span>{mode === "OPTION" ? <span>{selected.ivPercentile.label}</span> : <span>较昨日 {selected.dayOverDay?.trendScoreDelta !== null && selected.dayOverDay?.trendScoreDelta !== undefined ? `${selected.dayOverDay.trendScoreDelta > 0 ? "+" : ""}${selected.dayOverDay.trendScoreDelta}` : "暂无"}</span>}<span>量能 {selected.relativeVolume?.toFixed(1) ?? "—"}×</span><span>{gammaLabels[selected.gammaRegime]}</span></div>
          <Link href={`/stocks/${selected.symbol}`}>查看详情 →</Link>
        </> : <span>点击气泡查看完整读数；再次点击同一气泡进入详情。</span>}
      </div>
      <footer>
        <span>{mode === "OPTION" ? "气泡面积＝相对成交量；IV位置少于20个快照时属于初步结论。" : "气泡面积＝相对成交量；纵轴显示趋势分相较上一交易日的变化。"}</span>
        <span>已绘制 {plotted.length}/{cards.length}{unavailable.length > 0 ? ` · 未入图：${unavailableSummary}` : ""}</span>
      </footer>
    </section>
  );
}

export function StockScanner({ cards }: { cards: ScanCard[] }) {
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("ALL");
  const [activeSignals, setActiveSignals] = useState<SignalFilter[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("TREND");
  const [mobileView, setMobileView] = useState<MobileView>("LIST");
  const [query, setQuery] = useState("");
  const [prefetchSymbol, setPrefetchSymbol] = useState<SupportedSymbol | null>(null);

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
    return sortCards(filtered, sortMode) as ScanCard[];
  }, [activeSignals, assetFilter, cards, query, sortMode]);

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
          <div className="scanner-sort" aria-label="首页排序">
            <span>排序</span>
            <button type="button" className={sortMode === "TREND" ? "active" : ""} aria-pressed={sortMode === "TREND"} onClick={() => setSortMode("TREND")}>趋势强度</button>
            <button type="button" className={sortMode === "CHANGE" ? "active" : ""} aria-pressed={sortMode === "CHANGE"} onClick={() => setSortMode("CHANGE")}>今日变化</button>
          </div>
          <div className="scanner-view-switch" aria-label="手机端首页视图">
            <button type="button" className={mobileView === "LIST" ? "active" : ""} aria-pressed={mobileView === "LIST"} onClick={() => setMobileView("LIST")}>清单</button>
            <button type="button" className={mobileView === "MAP" ? "active" : ""} aria-pressed={mobileView === "MAP"} onClick={() => setMobileView("MAP")}>分布图</button>
          </div>
          <div className="scanner-market-line"><span>显示 <b>{visibleCards.length}</b> / {cards.length}</span><i>{sortMode === "TREND" ? "趋势分由高到低" : "结构变化由大到小"}</i></div>
        </div>
      </div>

      <div className={`scanner-content mobile-view-${mobileView.toLocaleLowerCase()}`}>
        <div className="scanner-table" aria-live="polite">
          <div className="scanner-head" aria-hidden="true"><span>股票</span><span>收盘表现</span><span>趋势判断</span><span>期权结构</span><span>主要关注理由</span><span>日期</span><i /></div>
          {visibleCards.map((stock) => {
            const trend = trendPresentation(stock.trendScore);
            const changes = meaningfulChangeItems(stock.dayOverDay);
            const secondaryChanges = changes.slice(0, 2);
            const hiddenChanges = Math.max(0, changes.length - secondaryChanges.length);
            const showVolume = stock.relativeVolume !== null && (stock.relativeVolume >= 1.3 || stock.relativeVolume <= 0.7);
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
                <div className="scanner-signal">
                  <small>趋势判断</small><strong>{stock.trendScore ?? "—"}</strong>
                  <b><i className={`status-dot ${trend.tone}`} />{trend.label}</b>
                  <span className="scanner-confidence" title={stock.trendConfidence.reason}>{confidencePresentation(stock.trendConfidence)}</span>
                  {showVolume && <em>量能 {stock.relativeVolume!.toFixed(1)}×</em>}
                  <span className={`scanner-mobile-gamma ${gammaTone[stock.gammaRegime]}`}>{gammaShortLabels[stock.gammaRegime]}</span>
                </div>
                <div className={`scanner-gamma ${gammaTone[stock.gammaRegime]}`}><small>期权结构</small><b>{gammaLabels[stock.gammaRegime]}</b><em>{stock.ivPercentile.label}</em></div>
                <div className="scanner-change">
                  <small>主要关注理由</small>
                  <strong className={`scanner-primary-reason ${stock.attention.tone}`} title={stock.attention.detail}>{stock.attention.label}</strong>
                  <div className="scanner-change-chips">
                    {secondaryChanges.map((item) => <span className={`day-change-chip ${item.tone}`} key={item.label}>{item.label}</span>)}
                    {hiddenChanges > 0 && <span className="day-change-chip more">+{hiddenChanges}</span>}
                  </div>
                </div>
                <time dateTime={stock.dataDate ?? undefined}>{stock.dataDate ?? "—"}</time>
                <i className="scanner-arrow" aria-hidden="true">→</i>
              </Link>
            );
          })}
          {!visibleCards.length && <div className="scanner-empty">当前筛选或搜索下没有符合条件的标的。</div>}
        </div>

        <StructureDistribution cards={visibleCards} />
      </div>
      <footer><span>“安静强势”＝趋势分≥70、IV位置≤30且趋势样本至少中等；“结构突变”用于发现变化，不判断涨跌。</span><b>用于研究排序，不构成投资建议。</b></footer>
    </section>
  );
}
