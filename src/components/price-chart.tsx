"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CandlestickSeries, ColorType, createChart, HistogramSeries, LineSeries, LineStyle, type Time } from "lightweight-charts";

type Point = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  ma50: number | null;
  ma100: number | null;
  ma200: number | null;
  bollingerUpper: number | null;
  bollingerMiddle: number | null;
  bollingerLower: number | null;
  bollingerPercentB: number | null;
  bollingerBandwidth: number | null;
  rsi14: number | null;
  volume: number | null;
  volumeAverage20: number | null;
  relativeVolume: number | null;
};
type WallLevel = { strike: number | null; strength: number | null; persistenceSnapshots: number };
type PriceLevels = { maxPain: number | null; callWall: WallLevel; putWall: WallLevel; expectedUpper: number | null; expectedLower: number | null };
type PriceOverlay = "averages" | "bollinger";

function compactVolume(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function chartTimeKey(time: Time | undefined) {
  if (time === undefined) return null;
  if (typeof time === "string") return time;
  if (typeof time === "number") return new Date(time * 1000).toISOString().slice(0, 10);
  return `${time.year}-${String(time.month).padStart(2, "0")}-${String(time.day).padStart(2, "0")}`;
}

function wallHistoryLabel(count: number) {
  if (count === 0) return "暂无记录";
  return count === 1 ? "仅1份记录" : `连续${count}份记录`;
}

export function PriceChart({ data, levels }: { data: Point[]; levels: PriceLevels }) {
  const container = useRef<HTMLDivElement>(null);
  const [priceOverlay, setPriceOverlay] = useState<PriceOverlay>("averages");
  const [showOptionLevels, setShowOptionLevels] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [activePoint, setActivePoint] = useState<Point | null>(data.at(-1) ?? null);
  const dataByDate = useMemo(() => new Map(data.map((point) => [point.date, point])), [data]);

  useEffect(() => {
    if (!container.current || !data.length) return;
    const rightWhitespaceBars = Math.max(15, Math.ceil(data.length / 4));
    const chart = createChart(container.current, {
      autoSize: true,
      height: container.current.clientWidth < 640 ? 280 : 360,
      layout: { background: { type: ColorType.Solid, color: "#10151d" }, textColor: "#8994a4" },
      grid: { vertLines: { color: "#1b222d" }, horzLines: { color: "#1b222d" } },
      rightPriceScale: { borderColor: "#252d39", scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { borderColor: "#252d39", timeVisible: false, rightOffset: rightWhitespaceBars },
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: { time: true, price: false }, axisDoubleClickReset: true },
      localization: { locale: "zh-CN" },
    });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#57d68d", downColor: "#f06f78", wickUpColor: "#57d68d", wickDownColor: "#f06f78", borderVisible: false, priceLineVisible: false,
    });
    candles.setData(data.map((point) => ({ time: point.date as Time, open: point.open, high: point.high, low: point.low, close: point.close })));
    candles.priceScale().applyOptions({ scaleMargins: { top: 0.06, bottom: showVolume ? 0.27 : 0.08 } });

    if (showVolume) {
      const volume = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" }, priceScaleId: "volume", priceLineVisible: false, lastValueVisible: false,
      });
      volume.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
      volume.setData(data.filter((point) => point.volume !== null).map((point) => ({
        time: point.date as Time,
        value: point.volume!,
        color: point.close >= point.open ? "rgba(87,214,141,.48)" : "rgba(240,111,120,.48)",
      })));
      const averageVolume = chart.addSeries(LineSeries, { color: "#9da7b5", lineWidth: 1, priceScaleId: "volume", priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      averageVolume.setData(data.filter((point) => point.volumeAverage20 !== null).map((point) => ({ time: point.date as Time, value: point.volumeAverage20! })));
    }

    const series = [
      { key: "ma50" as const, color: "#57d68d", width: 2 as const },
      { key: "ma100" as const, color: "#4f8cff", width: 2 as const },
      { key: "ma200" as const, color: "#f0b45c", width: 2 as const },
    ];
    if (priceOverlay === "averages") {
      for (const item of series) {
        const line = chart.addSeries(LineSeries, { color: item.color, lineWidth: item.width, priceLineVisible: false, lastValueVisible: false });
        line.setData(data.filter((point) => point[item.key] !== null).map((point) => ({ time: point.date as Time, value: point[item.key]! })));
      }
    }
    if (priceOverlay === "bollinger") {
      const bollingerSeries = [
        { key: "bollingerUpper" as const, color: "rgba(79,140,255,.82)", width: 1 as const, style: LineStyle.Solid },
        { key: "bollingerMiddle" as const, color: "rgba(243,246,250,.62)", width: 1 as const, style: LineStyle.Dashed },
        { key: "bollingerLower" as const, color: "rgba(79,140,255,.82)", width: 1 as const, style: LineStyle.Solid },
      ];
      for (const item of bollingerSeries) {
        const line = chart.addSeries(LineSeries, {
          color: item.color,
          lineWidth: item.width,
          lineStyle: item.style,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        line.setData(data.filter((point) => point[item.key] !== null).map((point) => ({ time: point.date as Time, value: point[item.key]! })));
      }
    }
    const priceLines = [
      { price: levels.callWall.strike, color: "#4f8cff", title: `看涨墙｜强度${levels.callWall.strength ?? "—"}/100｜${wallHistoryLabel(levels.callWall.persistenceSnapshots)}`, style: levels.callWall.persistenceSnapshots >= 2 ? LineStyle.Solid : LineStyle.Dashed, width: Math.min(4, Math.max(1, Math.ceil((levels.callWall.strength ?? 25) / 25))) as 1 | 2 | 3 | 4 },
      { price: levels.putWall.strike, color: "#f0b45c", title: `看跌墙｜强度${levels.putWall.strength ?? "—"}/100｜${wallHistoryLabel(levels.putWall.persistenceSnapshots)}`, style: levels.putWall.persistenceSnapshots >= 2 ? LineStyle.Solid : LineStyle.Dashed, width: Math.min(4, Math.max(1, Math.ceil((levels.putWall.strength ?? 25) / 25))) as 1 | 2 | 3 | 4 },
      { price: levels.maxPain, color: "#f3f6fa", title: "最近到期最大痛点", style: LineStyle.Dashed, width: 1 as const },
      { price: levels.expectedUpper, color: "#57d68d", title: "期权估算上沿", style: LineStyle.Dotted, width: 1 as const },
      { price: levels.expectedLower, color: "#57d68d", title: "期权估算下沿", style: LineStyle.Dotted, width: 1 as const },
    ];
    if (showOptionLevels) {
      for (const level of priceLines) {
        if (level.price === null || !Number.isFinite(level.price)) continue;
        candles.createPriceLine({ price: level.price, color: level.color, lineWidth: level.width, lineStyle: level.style, axisLabelVisible: true, title: level.title });
      }
    }
    chart.timeScale().fitContent();
    chart.timeScale().applyOptions({ rightOffset: rightWhitespaceBars });
    chart.subscribeCrosshairMove((param) => {
      const key = chartTimeKey(param.time);
      if (key) setActivePoint(dataByDate.get(key) ?? data.at(-1) ?? null);
    });
    chart.subscribeClick((param) => {
      const key = chartTimeKey(param.time);
      if (key) setActivePoint(dataByDate.get(key) ?? data.at(-1) ?? null);
    });
    return () => chart.remove();
  }, [data, dataByDate, levels, priceOverlay, showOptionLevels, showVolume]);

  if (!data.length) return <div className="chart-empty">暂无价格历史数据</div>;
  return (
    <div className="price-chart-shell">
      <div className="chart-layer-controls" aria-label="K线图层开关">
        <div className="chart-overlay-choice" role="group" aria-label="价格覆盖层">
          <button type="button" aria-pressed={priceOverlay === "averages"} className={priceOverlay === "averages" ? "active" : ""} onClick={() => setPriceOverlay("averages")}><i className="averages" />均线</button>
          <button type="button" aria-pressed={priceOverlay === "bollinger"} className={priceOverlay === "bollinger" ? "active" : ""} onClick={() => setPriceOverlay("bollinger")}><i className="bollinger" />布林带</button>
        </div>
        <button type="button" aria-pressed={showOptionLevels} className={showOptionLevels ? "active" : ""} onClick={() => setShowOptionLevels((value) => !value)}><i className="levels" />期权价位</button>
        <button type="button" aria-pressed={showVolume} className={showVolume ? "active" : ""} onClick={() => setShowVolume((value) => !value)}><i className="volume" />成交量</button>
      </div>
      {activePoint && <div className="price-point-readout" aria-live="polite">
        <b>{activePoint.date}</b>
        <span>开盘 {activePoint.open.toFixed(2)}</span><span>最高 {activePoint.high.toFixed(2)}</span><span>最低 {activePoint.low.toFixed(2)}</span><span>收盘 {activePoint.close.toFixed(2)}</span>
        <small>
          {priceOverlay === "averages" ? (
            <>50日线 {activePoint.ma50?.toFixed(2) ?? "—"} · 100日线 {activePoint.ma100?.toFixed(2) ?? "—"} · 200日线 {activePoint.ma200?.toFixed(2) ?? "—"}</>
          ) : (
            <>布林带上轨 {activePoint.bollingerUpper?.toFixed(2) ?? "—"} · 中轨 {activePoint.bollingerMiddle?.toFixed(2) ?? "—"} · 下轨 {activePoint.bollingerLower?.toFixed(2) ?? "—"} · 带内位置 {activePoint.bollingerPercentB?.toFixed(2) ?? "—"} · 通道宽度 {activePoint.bollingerBandwidth === null ? "—" : `${(activePoint.bollingerBandwidth * 100).toFixed(1)}%`}</>
          )}
          <> · RSI {activePoint.rsi14?.toFixed(1) ?? "—"} · 成交量 {compactVolume(activePoint.volume)} · 20日平均 {compactVolume(activePoint.volumeAverage20)} · 相对成交量 {activePoint.relativeVolume?.toFixed(2) ?? "—"}×</>
        </small>
      </div>}
      <div ref={container} className="price-chart" aria-label="日K线、均线或布林带、成交量与期权价位图，点一下可读取具体数值" />
    </div>
  );
}
