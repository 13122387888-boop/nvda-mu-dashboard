"use client";

import { useEffect, useRef } from "react";
import { ColorType, createChart, LineSeries, type Time } from "lightweight-charts";

type Point = { date: string; close: number; ma20: number | null; ma50: number | null; ma200: number | null };

export function PriceChart({ data }: { data: Point[] }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current || !data.length) return;
    const chart = createChart(container.current, {
      autoSize: true,
      height: container.current.clientWidth < 640 ? 250 : 350,
      layout: { background: { type: ColorType.Solid, color: "#10151d" }, textColor: "#8994a4" },
      grid: { vertLines: { color: "#1b222d" }, horzLines: { color: "#1b222d" } },
      rightPriceScale: { borderColor: "#252d39" },
      timeScale: { borderColor: "#252d39", timeVisible: false },
      localization: { locale: "zh-CN" },
    });
    const series = [
      { key: "close" as const, color: "#f3f6fa", width: 2 as const },
      { key: "ma20" as const, color: "#57d68d", width: 2 as const },
      { key: "ma50" as const, color: "#4f8cff", width: 2 as const },
      { key: "ma200" as const, color: "#f0b45c", width: 2 as const },
    ];
    for (const item of series) {
      const line = chart.addSeries(LineSeries, { color: item.color, lineWidth: item.width, priceLineVisible: false, lastValueVisible: false });
      line.setData(data.filter((point) => point[item.key] !== null).map((point) => ({ time: point.date as Time, value: point[item.key]! })));
    }
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [data]);

  if (!data.length) return <div className="chart-empty">暂无价格历史数据</div>;
  return <div ref={container} className="price-chart" aria-label="近六个月价格与移动平均线走势图" />;
}
