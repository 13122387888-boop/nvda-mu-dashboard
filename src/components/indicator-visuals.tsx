import type { CSSProperties } from "react";
import { money, number, percent } from "@/lib/format";
import { MetricHelp, MetricLabel } from "@/components/metric-help";

type NullableNumber = number | null;
type GammaRegime = "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNAVAILABLE";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function compactMoney(value: number) {
  const formatter = new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 });
  return `${value < 0 ? "-" : ""}$${formatter.format(Math.abs(value))}`;
}

export function GammaExposureVisual({
  callGamma,
  putGamma,
  netGamma,
  regime,
}: {
  callGamma: number;
  putGamma: number;
  netGamma: number;
  regime: GammaRegime;
}) {
  const max = Math.max(callGamma, putGamma, 1);
  const labels = {
    POSITIVE: { title: "正 Gamma 代理", className: "positive", conclusion: "关键位附近更偏震荡与均值回归，潜在对冲流通常有抑制波动的倾向。" },
    NEGATIVE: { title: "负 Gamma 代理", className: "negative", conclusion: "突破关键位后波动可能被放大，追涨杀跌和跳空风险需要更高警惕。" },
    NEUTRAL: { title: "Gamma 接近中性", className: "neutral", conclusion: "Call 与 Put 的 Gamma 代理较均衡，当前结构对价格的方向性影响不明确。" },
    UNAVAILABLE: { title: "Gamma 数据不足", className: "neutral", conclusion: "当前期权数据不足以形成 Gamma 结构判断。" },
  } as const;
  const state = labels[regime];

  return (
    <div className={`visual-card gamma-visual ${state.className}`}>
      <div className="gamma-heading">
        <div><MetricLabel metric="gammaProxy">GAMMA 结构代理</MetricLabel><strong>{state.title}</strong></div>
        <div className="gamma-net"><span>净 Gamma / 标的变动 1%</span><b>{compactMoney(netGamma)}</b></div>
      </div>
      <div className="gamma-scale" role="img" aria-label={`Put Gamma 代理 ${compactMoney(putGamma)}，Call Gamma 代理 ${compactMoney(callGamma)}，当前${state.title}`}>
        <div className="gamma-side put"><i style={{ width: `${(putGamma / max) * 100}%` }} /></div>
        <i className="gamma-axis" />
        <div className="gamma-side call"><i style={{ width: `${(callGamma / max) * 100}%` }} /></div>
      </div>
      <div className="gamma-labels"><span>Put 负向代理 <b>{compactMoney(putGamma)}</b></span><span>Call 正向代理 <b>{compactMoney(callGamma)}</b></span></div>
      <p><b>结构结论：</b>{state.conclusion}</p>
      <small>口径说明：按 Call 为正、Put 为负的公开 OI 约定估算。公开未平仓量无法识别实际持仓者及其多空方向，因此这不是做市商真实 Gamma，只用于观察结构。</small>
    </div>
  );
}

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
        <div><span>趋势位置</span><div className="heading-with-help"><strong>收盘价相对均线</strong><MetricHelp metric="movingAverage" /></div></div>
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
  const rsiLabel = rsi === null ? "暂无数据" : rsi >= 70 ? "偏热" : rsi <= 30 ? "偏冷" : rsi >= 55 ? "偏强" : rsi <= 45 ? "偏弱" : "中性";
  const rvProgress = realizedVolatility === null ? 0 : clamp(realizedVolatility * 100, 0, 100);

  return (
    <div className="momentum-visual-grid">
      <div className="visual-card rsi-visual">
        <div className="visual-card-heading"><div><span>动量强弱</span><div className="heading-with-help"><strong>RSI 14</strong><MetricHelp metric="rsi14" /></div></div><b>{number(rsi)}</b></div>
        <div className="rsi-track" style={{ "--rsi-position": `${rsiPosition}%` } as CSSProperties} role="img" aria-label={`RSI14 ${number(rsi)}，${rsiLabel}`}><i /></div>
        <div className="rsi-labels"><span>超卖 30</span><b>{rsiLabel}</b><span>超买 70</span></div>
      </div>
      <div className="visual-card volatility-visual">
        <div className="volatility-ring" style={{ "--rv-progress": `${rvProgress}%` } as CSSProperties} role="img" aria-label={`20日年化历史波动率 ${percent(realizedVolatility)}`}>
          <div><strong>{percent(realizedVolatility)}</strong><span>RV20</span></div>
        </div>
        <div className="volatility-copy"><MetricLabel metric="rv20">已实现波动率</MetricLabel><strong>过去20个交易日</strong><small>按日收益率年化计算</small></div>
      </div>
    </div>
  );
}

export function MomentumInformation({ rsi, realizedVolatility, atmIv }: { rsi: NullableNumber; realizedVolatility: NullableNumber; atmIv: NullableNumber }) {
  const maxVol = Math.max(realizedVolatility ?? 0, atmIv ?? 0, 0.01);
  const dailyProxy = realizedVolatility === null ? null : realizedVolatility / Math.sqrt(252);
  const ratio = realizedVolatility === null || realizedVolatility <= 0 || atmIv === null ? null : atmIv / realizedVolatility;
  const spread = realizedVolatility === null || atmIv === null ? null : atmIv - realizedVolatility;
  const rsiState = rsi === null ? "数据不足" : rsi >= 70 ? "动量偏热" : rsi <= 30 ? "动量偏冷" : rsi >= 55 ? "动量偏强" : rsi <= 45 ? "动量偏弱" : "动量中性";
  const pricingState = ratio === null ? "数据不足" : ratio >= 1.2 ? "隐含波动较高" : ratio <= 0.8 ? "隐含波动较低" : "两者接近";

  return (
    <div className="visual-card momentum-information">
      <div className="visual-card-heading">
        <div><span>VOLATILITY PRICING</span><strong>波动定价与可读信息</strong></div>
        <small>IV 与 RV 仅作定价比较</small>
      </div>
      <div className="volatility-bars" role="img" aria-label={`实现波动率 ${percent(realizedVolatility)}，平值隐含波动率 ${percent(atmIv)}`}>
        <div><MetricLabel metric="rv20">过去20日实际波动 RV20</MetricLabel><b>{percent(realizedVolatility)}</b><i><em style={{ width: `${((realizedVolatility ?? 0) / maxVol) * 100}%` }} /></i></div>
        <div><MetricLabel metric="atmIv">最近到期平值期权 ATM IV</MetricLabel><b>{percent(atmIv)}</b><i><em className="implied" style={{ width: `${((atmIv ?? 0) / maxVol) * 100}%` }} /></i></div>
      </div>
      <div className="momentum-info-grid">
        <article><span>走势是否过热</span><strong>{rsiState}</strong><p>RSI14 为 {number(rsi)}；70以上偏热，30以下偏冷，中间区域用于观察强弱变化。</p></article>
        <article><span>近期日波动参考</span><strong>{dailyProxy === null ? "—" : `约 ±${percent(dailyProxy)}`}</strong><p>由 RV20 ÷ √252 折算，只是历史日波动尺度，不是下一交易日预测区间。</p></article>
        <article><span>期权如何定价波动</span><strong>{pricingState}</strong><p>{ratio === null ? "需要同时具备 ATM IV 与 RV20。" : `IV / RV 为 ${ratio.toFixed(2)} 倍，差值 ${spread! >= 0 ? "+" : ""}${(spread! * 100).toFixed(1)} 个百分点。`}</p></article>
      </div>
      <p className="momentum-takeaway"><b>可以获取：</b>当前动量位置、过去20日实际波动尺度，以及期权隐含波动相对近期实际波动是更高、更低还是接近。</p>
      <small>隐含波动较高不等于期权一定昂贵，较低也不等于一定便宜；到期时间、事件风险和波动偏斜仍会影响期权价格。</small>
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
        <div><MetricLabel metric="expectedRange">到期预期区间</MetricLabel><strong>{expectedMove === null ? "暂无数据" : `± ${money(expectedMove)}`}</strong></div>
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
        <MetricLabel metric="putCallOi">持仓结构</MetricLabel>
        <div><i className="call" /><b>Call {Math.round(callShare * 100)}%</b></div>
        <div><i className="put" /><b>Put {Math.round(putShare * 100)}%</b></div>
        <small>平值隐含波动率 {percent(atmIv)}</small>
      </div>
    </div>
  );
}
