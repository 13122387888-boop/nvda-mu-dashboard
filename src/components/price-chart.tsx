"use client";

import { useEffect, useRef } from "react";
import { CandlestickSeries, ColorType, createChart, LineSeries, LineStyle, type Time } from "lightweight-charts";

type Point = { date: string; open: number; high: number; low: number; close: number; ma20: number | null; ma50: number | null; ma200: number | null };
type PriceLevels = { maxPain: number | null; callWall: number | null; putWall: number | null; expectedUpper: number | null; expectedLower: number | null };

export function PriceChart({ data, levels }: { data: Point[]; levels: PriceLevels }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current || !data.length) return;
    const chart = createChart(container.current, {
      autoSize: true,
      height: container.current.clientWidth < 640 ? 300 : 410,
      layout: { background: { type: ColorType.Solid, color: "#10151d" }, textColor: "#8994a4" },
      grid: { vertLines: { color: "#1b222d" }, horzLines: { color: "#1b222d" } },
      rightPriceScale: { borderColor: "#252d39", scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { borderColor: "#252d39", timeVisible: false },
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
    for (const item of series) {
      const line = chart.addSeries(LineSeries, { color: item.color, lineWidth: item.width, priceLineVisible: false, lastValueVisible: false });
      line.setData(data.filter((point) => point[item.key] !== null).map((point) => ({ time: point.date as Time, value: point[item.key]! })));
    }
    const priceLines = [
      { price: levels.callWall, color: "#4f8cff", title: "看涨墙", style: LineStyle.Solid },
      { price: levels.putWall, color: "#f0b45c", title: "看跌墙", style: LineStyle.Solid },
      { price: levels.maxPain, color: "#f3f6fa", title: "最大痛点", style: LineStyle.Dashed },
      { price: levels.expectedUpper, color: "#57d68d", title: "预期上沿", style: LineStyle.Dotted },
      { price: levels.expectedLower, color: "#57d68d", title: "预期下沿", style: LineStyle.Dotted },
    ];
    for (const level of priceLines) {
      if (level.price === null || !Number.isFinite(level.price)) continue;
      candles.createPriceLine({ price: level.price, color: level.color, lineWidth: 1, lineStyle: level.style, axisLabelVisible: true, title: level.title });
    }
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [data, levels]);

  if (!data.length) return <div className="chart-empty">暂无价格历史数据</div>;
  return <div ref={container} className="price-chart" aria-label="近六个月日K、移动平均线与期权关键价位图" />;
}
