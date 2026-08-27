"use client";

import type { CSSProperties } from "react";
import { useState } from "react";

type Point = { strike: number; callOi: number; putOi: number };

export function OptionOiChart({ data }: { data: Point[] }) {
  const [selectedStrike, setSelectedStrike] = useState<number | null>(null);
  if (!data.length) return <div className="chart-empty">暂无期权持仓数据</div>;
  const max = Math.max(...data.flatMap((point) => [point.callOi, point.putOi]), 1);
  const mobileLabelStep = Math.max(1, Math.ceil(data.length / 8));
  const selected = data.find((point) => point.strike === selectedStrike) ?? null;
  const total = selected ? selected.callOi + selected.putOi : 0;
  const formatter = new Intl.NumberFormat("zh-CN");
  return (
    <div className="oi-scroll" aria-label="同一行权价坐标轴上，看涨未平仓量向上、看跌未平仓量向下">
      <div className="oi-chart" style={{ "--oi-columns": data.length } as CSSProperties}>
        {data.map((point, index) => (
          <div
            className={`oi-column ${selectedStrike === point.strike ? "selected" : ""}`}
            role="button"
            tabIndex={0}
            aria-label={`行权价 ${point.strike}，Call ${point.callOi}，Put ${point.putOi}`}
            onClick={() => setSelectedStrike(point.strike)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedStrike(point.strike); } }}
            key={point.strike}
          >
            <div className="oi-half oi-call-half"><i className="oi-bar call" style={{ height: `${(point.callOi / max) * 100}%` }} /></div>
            <span className={`oi-strike ${index % mobileLabelStep !== 0 && index !== data.length - 1 ? "mobile-sparse" : ""}`}>{point.strike}</span>
            <div className="oi-half oi-put-half"><i className="oi-bar put" style={{ height: `${(point.putOi / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="oi-caption"><span>完整展示 {data.length} 个行权价</span><b>Call ↑　Put ↓</b></div>
      <div className={`oi-readout ${selected ? "active" : ""}`} aria-live="polite">
        {selected ? <><b>行权价 {selected.strike}</b><span>Call {formatter.format(selected.callOi)} · {total ? Math.round(selected.callOi / total * 100) : 0}%</span><span>Put {formatter.format(selected.putOi)} · {total ? Math.round(selected.putOi / total * 100) : 0}%</span></> : <span>点击任一柱形查看精确未平仓量</span>}
      </div>
    </div>
  );
}
