"use client";

import type { CSSProperties } from "react";
import { useState } from "react";

type Point = { strike: number; callOi: number; putOi: number };
type ChangePoint = { strike: number; callDelta: number; putDelta: number };

export function OptionOiChart({ data, change }: { data: Point[]; change: { previousDate: string | null; matchedContracts: number; totalDelta: number | null; points: ChangePoint[] } }) {
  const [mode, setMode] = useState<"total" | "change">("total");
  const [selectedStrike, setSelectedStrike] = useState<number | null>(null);
  if (!data.length) return <div className="chart-empty">暂无可显示的期权合约</div>;
  const changeAvailable = Boolean(change.previousDate && change.matchedContracts && change.points.length);
  const chartData = mode === "change" && changeAvailable
    ? change.points.map((point) => ({ strike: point.strike, callOi: point.callDelta, putOi: point.putDelta }))
    : data;
  const max = Math.max(...chartData.flatMap((point) => [Math.abs(point.callOi), Math.abs(point.putOi)]), 1);
  const mobileLabelStep = Math.max(1, Math.ceil(chartData.length / 8));
  const selected = chartData.find((point) => point.strike === selectedStrike) ?? null;
  const total = selected && mode === "total" ? selected.callOi + selected.putOi : 0;
  const formatter = new Intl.NumberFormat("zh-CN");
  return (
    <div className="oi-scroll" aria-label="同一行权价上，Call未平仓量向上、Put未平仓量向下">
      <div className="oi-mode-row">
        <div className="oi-mode-switch" role="group" aria-label="未平仓量视图"><button className={mode === "total" ? "active" : ""} onClick={() => { setMode("total"); setSelectedStrike(null); }}>当前数量</button><button disabled={!changeAvailable} className={mode === "change" ? "active" : ""} onClick={() => { setMode("change"); setSelectedStrike(null); }}>和上次比</button></div>
        <span>{changeAvailable ? `与 ${change.previousDate} 相比 · ${change.matchedContracts} 个相同合约` : "保存两次期权数据后可查看变化"}</span>
      </div>
      {mode === "change" && <div className="oi-change-summary"><b>相同合约的数量合计变化</b><strong className={change.totalDelta !== null && change.totalDelta >= 0 ? "positive" : "negative"}>{change.totalDelta === null ? "—" : `${change.totalDelta >= 0 ? "+" : ""}${formatter.format(change.totalDelta)}`}</strong><span>只表示未结束合约数量变化，不代表买入、卖出或资金方向。</span></div>}
      <div className="oi-chart" style={{ "--oi-columns": chartData.length } as CSSProperties}>
        {chartData.map((point, index) => (
          <div
            className={`oi-column ${selectedStrike === point.strike ? "selected" : ""}`}
            role="button"
            tabIndex={0}
            aria-label={`行权价 ${point.strike}，Call ${point.callOi}，Put ${point.putOi}`}
            onClick={() => setSelectedStrike(point.strike)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedStrike(point.strike); } }}
            key={point.strike}
          >
            <div className="oi-half oi-call-half"><i className={`oi-bar call ${mode === "change" ? point.callOi >= 0 ? "increase" : "decrease" : ""}`} style={{ height: `${(Math.abs(point.callOi) / max) * 100}%` }} /></div>
            <span className={`oi-strike ${index % mobileLabelStep !== 0 && index !== data.length - 1 ? "mobile-sparse" : ""}`}>{point.strike}</span>
            <div className="oi-half oi-put-half"><i className={`oi-bar put ${mode === "change" ? point.putOi >= 0 ? "increase" : "decrease" : ""}`} style={{ height: `${(Math.abs(point.putOi) / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="oi-caption"><span>显示全部 {chartData.length} 个行权价</span><b>{mode === "change" ? "实色＝增加　描边＝减少" : "Call ↑　Put ↓"}</b></div>
      <div className={`oi-readout ${selected ? "active" : ""}`} aria-live="polite">
        {selected ? <><b>行权价 {selected.strike}</b><span>Call {mode === "change" && selected.callOi >= 0 ? "+" : ""}{formatter.format(selected.callOi)}{mode === "total" ? ` · ${total ? Math.round(selected.callOi / total * 100) : 0}%` : ""}</span><span>Put {mode === "change" && selected.putOi >= 0 ? "+" : ""}{formatter.format(selected.putOi)}{mode === "total" ? ` · ${total ? Math.round(selected.putOi / total * 100) : 0}%` : ""}</span></> : <span>点击柱形查看具体{mode === "change" ? "变化" : "数量"}</span>}
      </div>
    </div>
  );
}
