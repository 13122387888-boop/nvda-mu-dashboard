import type { CSSProperties } from "react";
import { money, number, percent } from "@/lib/format";
import { MetricLabel } from "@/components/metric-help";
import { calculateTrendScoreBreakdown } from "@/lib/indicators/stock-metrics";
import type { BollingerBandsSummary } from "@/lib/indicators/bollinger-bands";

type NullableNumber = number | null;
type GammaRegime = "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNAVAILABLE";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function compactMoney(value: number) {
  const formatter = new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 });
  return `${value < 0 ? "-" : ""}$${formatter.format(Math.abs(value))}`;
}

const signedContribution = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
const contributionTone = (value: number) => value > 0.05 ? "positive" : value < -0.05 ? "negative" : "neutral";

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
    POSITIVE: { title: "正 Gamma 代理", className: "stable", conclusion: "关键位附近更偏震荡与均值回归，潜在对冲流通常有抑制波动的倾向。" },
    NEGATIVE: { title: "负 Gamma 代理", className: "amplify", conclusion: "突破关键位后波动可能被放大，追涨杀跌和跳空风险需要更高警惕。" },
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
      <div className="gamma-labels"><span>看跌（Put）负向代理 <b>{compactMoney(putGamma)}</b></span><span>看涨（Call）正向代理 <b>{compactMoney(callGamma)}</b></span></div>
      <p><b>结构结论：</b>{state.conclusion}</p>
      <small>口径说明：按 Call 为正、Put 为负的公开 OI 约定估算。公开未平仓量无法识别实际持仓者及其多空方向，因此这不是做市商真实 Gamma，只用于观察结构。</small>
    </div>
  );
}

export function TrendDeviation({
  close,
  ma50,
  ma100,
  ma200,
  rsi14,
}: {
  close: number;
  ma50: NullableNumber;
  ma100: NullableNumber;
  ma200: NullableNumber;
  rsi14: NullableNumber;
}) {
  const breakdown = calculateTrendScoreBreakdown({ close, ma50, ma100, ma200, rsi14 });
  const optionalContribution = (source: NullableNumber, contribution: number) => source === null ? "暂无" : signedContribution(contribution);
  const levels = [
    { label: "现价", value: close, className: "spot" },
    { label: "50日均线", value: ma50, className: "ma50" },
    { label: "100日均线", value: ma100, className: "ma100" },
    { label: "200日均线", value: ma200, className: "ma200" },
  ].filter((level): level is { label: string; value: number; className: string } => level.value !== null && Number.isFinite(level.value));
  const ordered = [...levels].sort((a, b) => a.value - b.value);
  const rawMin = Math.min(...ordered.map((level) => level.value));
  const rawMax = Math.max(...ordered.map((level) => level.value));
  const rawSpan = Math.max(rawMax - rawMin, close * 0.04, 1);
  const min = rawMin - rawSpan * 0.08;
  const max = rawMax + rawSpan * 0.08;
  const position = (value: number) => `${((value - min) / (max - min)) * 100}%`;
  const relativeToSpot = (value: number, label: string) => {
    if (label === "现价") return "基准";
    const deviation = ((value - close) / close) * 100;
    if (Math.abs(deviation) < 0.005) return "与现价重合";
    return `${deviation > 0 ? "高于" : "低于"}现价 ${Math.abs(deviation).toFixed(1)}%`;
  };

  return (
    <div className="visual-card trend-visual trend-position-map">
      <div className="visual-card-heading">
        <div><span>趋势位置</span><div className="heading-with-help"><strong><MetricLabel metric="movingAverage">现价与均线位置</MetricLabel></strong></div></div>
        <small>同一价格轴 · 直接比较</small>
      </div>
      <div className="level-map-scroll">
        <div className="level-map" role="img" aria-label="现价与50日、100日、200日均线价格位置图">
          <i className="level-axis" />
          {ordered.map((level, index) => (
            <div className={`level-pin ${level.className} tier-${index % 4}`} style={{ "--level-left": position(level.value) } as CSSProperties} key={level.label}>
              <span>{level.label}</span><b>{money(level.value)}</b><i />
            </div>
          ))}
        </div>
      </div>
      <div className="level-ladder" aria-label="现价与均线完整列表">
        {[...ordered].reverse().map((level) => (
          <div className={level.className} key={level.label}>
            <i /><span>{level.label}</span><b>{money(level.value)}</b><small>{relativeToSpot(level.value, level.label)}</small>
          </div>
        ))}
      </div>
      {breakdown ? (
        <details className="trend-score-breakdown">
          <summary>
            <div><span>趋势分构成</span><small>点击展开计算过程</small></div>
            <strong>{breakdown.score}<small>/100</small></strong>
          </summary>
          <div className="trend-score-parts">
            <article className="neutral"><span>基础分</span><strong>50.0</strong><small>中性起点</small></article>
            <article className={contributionTone(breakdown.pricePosition.total)}><span>价格位置</span><strong>{signedContribution(breakdown.pricePosition.total)}</strong><small>50日 {optionalContribution(ma50, breakdown.pricePosition.ma50)} · 100日 {optionalContribution(ma100, breakdown.pricePosition.ma100)} · 200日 {optionalContribution(ma200, breakdown.pricePosition.ma200)}</small></article>
            <article className={contributionTone(breakdown.alignment.total)}><span>均线排列</span><strong>{signedContribution(breakdown.alignment.total)}</strong><small>50/100日 {ma50 === null || ma100 === null ? "暂无" : signedContribution(breakdown.alignment.ma50VsMa100)} · 100/200日 {ma100 === null || ma200 === null ? "暂无" : signedContribution(breakdown.alignment.ma100VsMa200)}</small></article>
            <article className={contributionTone(breakdown.momentum.contribution)}><span>RSI 动量</span><strong>{rsi14 === null ? "未参与" : signedContribution(breakdown.momentum.contribution)}</strong><small>RSI14 {rsi14 === null ? "暂无" : number(breakdown.momentum.rsi14, 1)}</small></article>
          </div>
          <footer>基础 50 {signedContribution(breakdown.pricePosition.total)} {signedContribution(breakdown.alignment.total)} {signedContribution(breakdown.momentum.contribution)} ＝ {breakdown.rawScore.toFixed(2)}；最终限制在 0–100 并四舍五入。它描述趋势结构，不是上涨概率。</footer>
        </details>
      ) : <div className="trend-score-unavailable"><b>趋势分暂不可算</b><span>至少需要两条完整均线；新上市标的会随历史数据积累自动出现分数。</span></div>}
    </div>
  );
}

export function MomentumVisual({
  rsi,
  realizedVolatility,
  close,
  bollinger,
}: {
  rsi: NullableNumber;
  realizedVolatility: NullableNumber;
  close: number;
  bollinger: BollingerBandsSummary;
}) {
  const rsiPosition = rsi === null ? 50 : clamp(rsi, 0, 100);
  const rsiLabel = rsi === null ? "暂无数据" : rsi >= 70 ? "偏热" : rsi <= 30 ? "偏冷" : rsi >= 55 ? "偏强" : rsi <= 45 ? "偏弱" : "中性";
  const bollPosition = bollinger.percentB === null ? 50 : ((clamp(bollinger.percentB, -0.2, 1.2) + 0.2) / 1.4) * 100;
  const bollPositionLabel = bollinger.percentB === null
    ? "位置暂无"
    : bollinger.percentB >= 1
      ? "上轨外"
      : bollinger.percentB >= 0.75
        ? "上轨附近"
        : bollinger.percentB >= 0.5
          ? "中轨上方"
          : bollinger.percentB >= 0.25
            ? "中轨下方"
            : bollinger.percentB >= 0
              ? "下轨附近"
              : "下轨外";
  const bollState = {
    SQUEEZE: "带宽收口",
    WIDE: "带宽偏宽",
    NORMAL: "带宽常态",
    UNAVAILABLE: "状态积累中",
  }[bollinger.state];
  const hasBollinger = bollinger.lower !== null && bollinger.middle !== null && bollinger.upper !== null && bollinger.percentB !== null;

  return (
    <div className="momentum-visual-grid">
      <div className="visual-card rsi-visual">
        <div className="visual-card-heading"><div><span>动量强弱</span><div className="heading-with-help"><strong><MetricLabel metric="rsi14">RSI 14</MetricLabel></strong></div></div><b>{number(rsi)}</b></div>
        <div className="rsi-track" style={{ "--rsi-position": `${rsiPosition}%` } as CSSProperties} role="img" aria-label={`RSI14 ${number(rsi)}，${rsiLabel}`}><i /></div>
        <div className="rsi-labels"><span>超卖 30</span><b>{rsiLabel}</b><span>超买 70</span></div>
      </div>
      <div className="visual-card bollinger-visual">
        <div className="visual-card-heading">
          <div><span>价格状态</span><div className="heading-with-help"><strong><MetricLabel metric="bollinger">BOLL 20,2</MetricLabel></strong></div></div>
          <b>{bollPositionLabel}</b>
        </div>
        {!hasBollinger ? <div className="mini-empty">至少需要 20 个交易日数据</div> : <>
          <div className="bollinger-track" style={{ "--boll-position": `${bollPosition}%` } as CSSProperties} role="img" aria-label={`现价 ${money(close)}，BOLL下轨 ${money(bollinger.lower)}，中轨 ${money(bollinger.middle)}，上轨 ${money(bollinger.upper)}，百分比B ${number(bollinger.percentB, 2)}`}>
            <i className="bollinger-band" />
            <i className="bollinger-midline" />
            <span className="bollinger-spot"><i /><b>{money(close)}</b></span>
          </div>
          <div className="bollinger-labels"><span>下轨<b>{money(bollinger.lower)}</b></span><span>中轨<b>{money(bollinger.middle)}</b></span><span>上轨<b>{money(bollinger.upper)}</b></span></div>
        </>}
        <div className="bollinger-summary">
          <span><b>{bollState}</b><small>{bollinger.bandwidthPercentile === null ? `近${bollinger.sampleSize}日·样本积累中` : `带宽处于近${bollinger.sampleSize}日第 ${bollinger.bandwidthPercentile} 分位`}</small></span>
          <span><b>{bollinger.percentB === null ? "%B —" : `%B ${number(bollinger.percentB, 2)}`}</b><small>带宽 {percent(bollinger.bandwidth)} · RV20 {percent(realizedVolatility)}</small></span>
        </div>
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
        <div><span>波动定价</span><strong>隐含波动与实际波动</strong></div>
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
  const points = [
    { label: "预期下沿", value: lower, className: "lower" },
    { label: "预期上沿", value: upper, className: "upper" },
    { label: "现价", value: close, className: "spot" },
    { label: "最大痛点", value: maxPain, className: "pain" },
    { label: "看涨墙", value: callWall, className: "call-wall" },
    { label: "看跌墙", value: putWall, className: "put-wall" },
  ].filter((point): point is { label: string; value: number; className: string } => point.value !== null && Number.isFinite(point.value))
    .sort((a, b) => a.value - b.value);
  const minimum = Math.min(...points.map((point) => point.value));
  const maximum = Math.max(...points.map((point) => point.value));
  const spread = Math.max(maximum - minimum, close * 0.02, 1);
  const domainMinimum = minimum - spread * 0.06;
  const domainMaximum = maximum + spread * 0.06;
  const position = (value: number) => clamp((value - domainMinimum) / (domainMaximum - domainMinimum) * 100, 0, 100);

  return (
    <div className="visual-card range-visual">
      <div className="visual-card-heading">
        <div><MetricLabel metric="expectedRange">到期预期区间</MetricLabel><strong>{expectedMove === null ? "暂无数据" : `± ${money(expectedMove)}`}</strong></div>
        <b>{expectedMovePct === null ? "—" : `± ${percent(expectedMovePct)}`}</b>
      </div>
      {lower === null || upper === null ? <div className="mini-empty">暂无可用期权区间</div> : <>
        <div className="range-plot" role="img" aria-label={`预期价格区间 ${money(lower)} 至 ${money(upper)}，并标注现价、最大痛点、看涨墙和看跌墙`}>
          <i className="range-axis" />
          <i className="range-band" style={{ left: `${position(lower)}%`, width: `${Math.max(position(upper) - position(lower), 1)}%` }} />
          {points.map((point, index) => {
            const left = position(point.value);
            const edge = left < 8 ? "edge-left" : left > 92 ? "edge-right" : "";
            return <span className={`range-point ${point.className} lane-${index % 3} ${edge}`} style={{ left: `${left}%` }} key={point.label}><i /><small>{point.label}</small><b>{money(point.value)}</b></span>;
          })}
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
      <div className="visual-card-heading put-call-heading">
        <div><MetricLabel metric="putCallOi">持仓结构</MetricLabel><strong>看涨 / 看跌未平仓量</strong></div>
        <b>{number(ratio)} <small>未平仓量比（Put/Call）</small></b>
      </div>
      <div className="put-call-bar" role="img" aria-label={`Call 占 ${Math.round(callShare * 100)}%，Put 占 ${Math.round(putShare * 100)}%`}>
        <i className="call" style={{ width: `${callShare * 100}%` }} />
        <i className="put" style={{ width: `${putShare * 100}%` }} />
      </div>
      <div className="put-call-sides">
        <div className="call"><span>看涨（Call）</span><strong>{Math.round(callShare * 100)}%</strong><small>看涨未平仓量占比</small></div>
        <div className="put"><span>看跌（Put）</span><strong>{Math.round(putShare * 100)}%</strong><small>看跌未平仓量占比</small></div>
      </div>
      <small className="put-call-note">平值隐含波动率 {percent(atmIv)}</small>
    </div>
  );
}
