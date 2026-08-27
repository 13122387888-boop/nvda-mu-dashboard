import type { CSSProperties } from "react";
import { money, number, percent } from "@/lib/format";

type NullableNumber = number | null;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function TrendDeviation({
  close,
  ma20,
  ma50,
  ma200,
}: {
  close: number;
  ma20: NullableNumber;
  ma50: NullableNumber;
  ma200: NullableNumber;
}) {
  const rows = [
    { label: "20日均线", value: ma20, color: "#57d68d" },
    { label: "50日均线", value: ma50, color: "#4f8cff" },
    { label: "200日均线", value: ma200, color: "#f0b45c" },
  ];

  return (
    <div className="visual-card trend-visual">
      <div className="visual-card-heading">
        <div><span>趋势位置</span><strong>收盘价相对均线</strong></div>
        <small>中轴为均线 · 满刻度 ±10%</small>
      </div>
      <div className="deviation-list">
        {rows.map((row) => {
          const deviation = row.value === null || row.value === 0 ? null : ((close / row.value) - 1) * 100;
          const magnitude = deviation === null ? 0 : clamp(Math.abs(deviation) / 10 * 50, 0, 50);
          return (
            <div className="deviation-row" key={row.label}>
              <div className="deviation-meta"><span><i style={{ background: row.color }} />{row.label}</span><b>{row.value === null ? "—" : money(row.value)}</b></div>
              <div className="deviation-track" aria-label={`${row.label}偏离 ${deviation === null ? "暂无" : `${deviation.toFixed(2)}%`}`}>
                <i className="deviation-center" />
                {deviation !== null && <i className={`deviation-fill ${deviation >= 0 ? "above" : "below"}`} style={{ "--magnitude": `${magnitude}%`, "--bar-color": row.color } as CSSProperties} />}
              </div>
              <strong className={deviation !== null && deviation >= 0 ? "positive" : "negative"}>{deviation === null ? "—" : `${deviation >= 0 ? "+" : ""}${deviation.toFixed(2)}%`}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MomentumVisual({ rsi, realizedVolatility }: { rsi: NullableNumber; realizedVolatility: NullableNumber }) {
  const rsiPosition = rsi === null ? 50 : clamp(rsi, 0, 100);
  const rsiLabel = rsi === null ? "暂无数据" : rsi >= 70 ? "偏热" : rsi <= 30 ? "偏冷" : "中性区间";
  const rvProgress = realizedVolatility === null ? 0 : clamp(realizedVolatility * 100, 0, 100);

  return (
    <div className="momentum-visual-grid">
      <div className="visual-card rsi-visual">
        <div className="visual-card-heading"><div><span>动量强弱</span><strong>RSI 14</strong></div><b>{number(rsi)}</b></div>
        <div className="rsi-track" style={{ "--rsi-position": `${rsiPosition}%` } as CSSProperties} role="img" aria-label={`RSI14 ${number(rsi)}，${rsiLabel}`}><i /></div>
        <div className="rsi-labels"><span>超卖 30</span><b>{rsiLabel}</b><span>超买 70</span></div>
      </div>
      <div className="visual-card volatility-visual">
        <div className="volatility-ring" style={{ "--rv-progress": `${rvProgress}%` } as CSSProperties} role="img" aria-label={`20日年化历史波动率 ${percent(realizedVolatility)}`}>
          <div><strong>{percent(realizedVolatility)}</strong><span>RV20</span></div>
        </div>
        <div className="volatility-copy"><span>已实现波动率</span><strong>过去20个交易日</strong><small>按日收益率年化计算</small></div>
      </div>
    </div>
  );
}

function markerPosition(value: NullableNumber, lower: NullableNumber, upper: NullableNumber) {
  if (value === null || lower === null || upper === null || upper <= lower) return null;
  return `${clamp((value - lower) / (upper - lower) * 100, 0, 100)}%`;
}

export function ExpectedRangeVisual({
  close,
  lower,
  upper,
  expectedMove,
  expectedMovePct,
  maxPain,
  callWall,
  putWall,
}: {
  close: number;
  lower: NullableNumber;
  upper: NullableNumber;
  expectedMove: NullableNumber;
  expectedMovePct: NullableNumber;
  maxPain: NullableNumber;
  callWall: NullableNumber;
  putWall: NullableNumber;
}) {
  const markers = [
    { label: "现价", value: close, className: "spot" },
    { label: "最大痛点", value: maxPain, className: "pain" },
    { label: "看涨墙", value: callWall, className: "call-wall" },
    { label: "看跌墙", value: putWall, className: "put-wall" },
  ];

  return (
    <div className="visual-card range-visual">
      <div className="visual-card-heading">
        <div><span>到期预期区间</span><strong>{expectedMove === null ? "暂无数据" : `± ${money(expectedMove)}`}</strong></div>
        <b>{expectedMovePct === null ? "—" : `± ${percent(expectedMovePct)}`}</b>
      </div>
      {lower === null || upper === null ? <div className="mini-empty">暂无可用期权区间</div> : <>
        <div className="range-label-row"><b>{money(lower)}</b><span>市场隐含波动范围</span><b>{money(upper)}</b></div>
        <div className="range-track" role="img" aria-label={`预期价格区间 ${money(lower)} 至 ${money(upper)}`}>
          <i className="range-band" />
          {markers.map((marker) => {
            const left = markerPosition(marker.value, lower, upper);
            return left && <i className={`range-marker ${marker.className}`} style={{ left }} key={marker.label} title={`${marker.label} ${money(marker.value)}`} />;
          })}
        </div>
        <div className="range-legend">
          {markers.map((marker) => <span key={marker.label}><i className={marker.className} />{marker.label}<b>{money(marker.value)}</b></span>)}
        </div>
      </>}
    </div>
  );
}

export function PutCallVisual({ ratio, atmIv }: { ratio: NullableNumber; atmIv: NullableNumber }) {
  const putShare = ratio === null ? 0.5 : clamp(ratio / (1 + ratio), 0, 1);
  const callShare = 1 - putShare;
  return (
    <div className="visual-card put-call-visual">
      <div className="donut" style={{ "--put-share": `${putShare * 100}%` } as CSSProperties} role="img" aria-label={`Put Call 持仓比 ${number(ratio)}`}>
        <div><strong>{number(ratio)}</strong><span>Put / Call</span></div>
      </div>
      <div className="donut-copy">
        <span>持仓结构</span>
        <div><i className="call" /><b>Call {Math.round(callShare * 100)}%</b></div>
        <div><i className="put" /><b>Put {Math.round(putShare * 100)}%</b></div>
        <small>平值隐含波动率 {percent(atmIv)}</small>
      </div>
    </div>
  );
}
