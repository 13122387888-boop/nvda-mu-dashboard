"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CandlestickSeries, ColorType, createChart, LineSeries, LineStyle, type Time } from "lightweight-charts";

type Point = { date: string; open: number; high: number; low: number; close: number; ma20: number | null; ma50: number | null; ma200: number | null };
type PriceLevels = { maxPain: number | null; callWall: number | null; putWall: number | null; expectedUpper: number | null; expectedLower: number | null };

function chartTimeKey(time: Time | undefined) {
  if (time === undefined) return null;
  if (typeof time === "string") return time;
  if (typeof time === "number") return new Date(time * 1000).toISOString().slice(0, 10);
  return `${time.year}-${String(time.month).padStart(2, "0")}-${String(time.day).padStart(2, "0")}`;
}

export function PriceChart({ data, levels }: { data: Point[]; levels: PriceLevels }) {
  const container = useRef<HTMLDivElement>(null);
  const [showAverages, setShowAverages] = useState(true);
  const [showOptionLevels, setShowOptionLevels] = useState(true);
  const [activePoint, setActivePoint] = useState<Point | null>(data.at(-1) ?? null);
  const dataByDate = useMemo(() => new Map(data.map((point) => [point.date, point])), [data]);

  useEffect(() => {
    if (!container.current || !data.length) return;
    const rightWhitespaceBars = Math.max(18, Math.ceil(data.length / 3));
    const chart = createChart(container.current, {
      autoSize: true,
      height: container.current.clientWidth < 640 ? 300 : 410,
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

    const series = [
      { key: "ma20" as const, color: "#57d68d", width: 2 as const },
      { key: "ma50" as const, color: "#4f8cff", width: 2 as const },
      { key: "ma200" as const, color: "#f0b45c", width: 2 as const },
    ];
    if (showAverages) {
      for (const item of series) {
        const line = chart.addSeries(LineSeries, { color: item.color, lineWidth: item.width, priceLineVisible: false, lastValueVisible: false });
        line.setData(data.filter((point) => point[item.key] !== null).map((point) => ({ time: point.date as Time, value: point[item.key]! })));
      }
    }
    const priceLines = [
      { price: levels.callWall, color: "#4f8cff", title: "看涨墙", style: LineStyle.Solid },
      { price: levels.putWall, color: "#f0b45c", title: "看跌墙", style: LineStyle.Solid },
      { price: levels.maxPain, color: "#f3f6fa", title: "最大痛点", style: LineStyle.Dashed },
      { price: levels.expectedUpper, color: "#57d68d", title: "预期上沿", style: LineStyle.Dotted },
      { price: levels.expectedLower, color: "#57d68d", title: "预期下沿", style: LineStyle.Dotted },
    ];
    if (showOptionLevels) {
      for (const level of priceLines) {
        if (level.price === null || !Number.isFinite(level.price)) continue;
        candles.createPriceLine({ price: level.price, color: level.color, lineWidth: 1, lineStyle: level.style, axisLabelVisible: true, title: level.title });
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
  }, [data, dataByDate, levels, showAverages, showOptionLevels]);

  if (!data.length) return <div className="chart-empty">暂无价格历史数据</div>;
  return (
    <div className="price-chart-shell">
      <div className="chart-layer-controls" aria-label="K线图层开关">
        <button type="button" aria-pressed={showAverages} className={showAverages ? "active" : ""} onClick={() => setShowAverages((value) => !value)}><i className="averages" />均线</button>
        <button type="button" aria-pressed={showOptionLevels} className={showOptionLevels ? "active" : ""} onClick={() => setShowOptionLevels((value) => !value)}><i className="levels" />期权关键位</button>
      </div>
      {activePoint && <div className="price-point-readout" aria-live="polite">
        <b>{activePoint.date}</b>
        <span>开 {activePoint.open.toFixed(2)}</span><span>高 {activePoint.high.toFixed(2)}</span><span>低 {activePoint.low.toFixed(2)}</span><span>收 {activePoint.close.toFixed(2)}</span>
        <small>MA20 {activePoint.ma20?.toFixed(2) ?? "—"} · MA50 {activePoint.ma50?.toFixed(2) ?? "—"} · MA200 {activePoint.ma200?.toFixed(2) ?? "—"}</small>
      </div>}
      <div ref={container} className="price-chart" aria-label="近六个月日K、移动平均线与期权关键价位图，点按可读取精确数值" />
    </div>
  );
}
