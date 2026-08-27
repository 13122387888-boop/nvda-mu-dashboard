import type { CSSProperties } from "react";

type Point = { strike: number; callOi: number; putOi: number };

export function OptionOiChart({ data }: { data: Point[] }) {
  if (!data.length) return <div className="chart-empty">暂无期权持仓数据</div>;
  const max = Math.max(...data.flatMap((point) => [point.callOi, point.putOi]), 1);
  const mobileLabelStep = Math.max(1, Math.ceil(data.length / 8));
  return (
    <div className="oi-scroll" role="img" aria-label="同一行权价坐标轴上，看涨未平仓量向上、看跌未平仓量向下">
      <div className="oi-chart" style={{ "--oi-columns": data.length } as CSSProperties}>
        {data.map((point, index) => (
          <div className="oi-column" key={point.strike} title={`行权价 ${point.strike}：Call ${point.callOi}，Put ${point.putOi}`}>
            <div className="oi-half oi-call-half"><i className="oi-bar call" style={{ height: `${(point.callOi / max) * 100}%` }} /></div>
            <span className={`oi-strike ${index % mobileLabelStep !== 0 && index !== data.length - 1 ? "mobile-sparse" : ""}`}>{point.strike}</span>
            <div className="oi-half oi-put-half"><i className="oi-bar put" style={{ height: `${(point.putOi / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="oi-caption"><span>完整展示 {data.length} 个行权价</span><b>Call ↑　Put ↓</b></div>
    </div>
  );
}
