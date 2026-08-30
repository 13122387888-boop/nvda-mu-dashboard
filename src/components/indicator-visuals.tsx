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
    POSITIVE: { title: "正值：Call 侧估算较大", className: "stable", conclusion: "这里的正值只表示 Call 侧估算较大，不表示看涨。可继续观察关键位附近是否更容易震荡，但不能确认波动一定收敛。" },
    NEGATIVE: { title: "负值：Put 侧估算较大", className: "amplify", conclusion: "这里的负值只表示 Put 侧估算较大，不表示看跌。可留意离开关键位后波动是否扩大，但不能确认波动一定放大。" },
    NEUTRAL: { title: "Call 与 Put 两侧估算接近", className: "neutral", conclusion: "两侧估算值接近，当前没有明显偏向。" },
    UNAVAILABLE: { title: "暂时算不出 Gamma", className: "neutral", conclusion: "当前期权数据不足，暂时无法比较两侧结构。" },
  } as const;
  const state = labels[regime];

  return (
    <div className={`visual-card gamma-visual ${state.className}`}>
      <div className="gamma-heading">
        <div><MetricLabel metric="gammaProxy">Gamma 偏向哪一侧</MetricLabel><strong>{state.title}</strong></div>
        <div className="gamma-net"><span>股价变动1%时，Delta 金额的净变化估算</span><b>{compactMoney(netGamma)}</b></div>
      </div>
      <div className="gamma-scale" role="img" aria-label={`Put Gamma 代理 ${compactMoney(putGamma)}，Call Gamma 代理 ${compactMoney(callGamma)}，当前${state.title}`}>
        <div className="gamma-side put"><i style={{ width: `${(putGamma / max) * 100}%` }} /></div>
        <i className="gamma-axis" />
        <div className="gamma-side call"><i style={{ width: `${(callGamma / max) * 100}%` }} /></div>
      </div>
      <div className="gamma-labels"><span>Put 侧（按负值计） <b>{compactMoney(putGamma)}</b></span><span>Call 侧（按正值计） <b>{compactMoney(callGamma)}</b></span></div>
      <p><b>怎么看：</b>{state.conclusion}</p>
      <small>这里只按公开未平仓量估算，无法识别谁持有、是买入还是卖出，因此不是真实做市商 Gamma。</small>
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
    { label: "50日线", value: ma50, className: "ma50" },
    { label: "100日线", value: ma100, className: "ma100" },
    { label: "200日线", value: ma200, className: "ma200" },
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
        <div><span>中长期方向</span><div className="heading-with-help"><strong><MetricLabel metric="movingAverage">现价和三条均线</MetricLabel></strong></div></div>
        <small>看现价在均线上方还是下方</small>
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
            <div><span>趋势分怎么算</span><small>点击查看加分和减分</small></div>
            <strong>{breakdown.score}<small>/100</small></strong>
          </summary>
          <div className="trend-score-parts">
            <article className="neutral"><span>基础分</span><strong>50.0</strong><small>中性起点</small></article>
            <article className={contributionTone(breakdown.pricePosition.total)}><span>现价与均线</span><strong>{signedContribution(breakdown.pricePosition.total)}</strong><small>50日 {optionalContribution(ma50, breakdown.pricePosition.ma50)} · 100日 {optionalContribution(ma100, breakdown.pricePosition.ma100)} · 200日 {optionalContribution(ma200, breakdown.pricePosition.ma200)}</small></article>
            <article className={contributionTone(breakdown.alignment.total)}><span>均线顺序</span><strong>{signedContribution(breakdown.alignment.total)}</strong><small>50/100日 {ma50 === null || ma100 === null ? "暂无" : signedContribution(breakdown.alignment.ma50VsMa100)} · 100/200日 {ma100 === null || ma200 === null ? "暂无" : signedContribution(breakdown.alignment.ma100VsMa200)}</small></article>
            <article className={contributionTone(breakdown.momentum.contribution)}><span>近期强弱（RSI）</span><strong>{rsi14 === null ? "未参与" : signedContribution(breakdown.momentum.contribution)}</strong><small>RSI {rsi14 === null ? "暂无" : number(breakdown.momentum.rsi14, 1)}</small></article>
          </div>
          <footer>从中性 50 分开始，根据现价和均线、均线顺序及 RSI 加减分，最后限制在 0–100。趋势分不是上涨概率。</footer>
        </details>
      ) : <div className="trend-score-unavailable"><b>历史数据还不够</b><span>至少有两条完整均线后，才会显示趋势分。</span></div>}
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
      ? "高于上轨"
      : bollinger.percentB >= 0.75
        ? "靠近上轨"
      : bollinger.percentB >= 0.5
          ? "位于中轨上方"
        : bollinger.percentB >= 0.25
            ? "位于中轨下方"
          : bollinger.percentB >= 0
              ? "靠近下轨"
              : "低于下轨";
  const bollState = {
    SQUEEZE: "通道偏窄",
    WIDE: "通道偏宽",
    NORMAL: "通道宽度正常",
    UNAVAILABLE: "数据积累中",
  }[bollinger.state];
  const hasBollinger = bollinger.lower !== null && bollinger.middle !== null && bollinger.upper !== null && bollinger.percentB !== null;

  return (
    <div className="momentum-visual-grid">
      <div className="visual-card rsi-visual">
        <div className="visual-card-heading"><div><span>最近涨跌力度</span><div className="heading-with-help"><strong><MetricLabel metric="rsi14">短线强弱（RSI）</MetricLabel></strong></div></div><b>{number(rsi)}</b></div>
        <div className="rsi-track" style={{ "--rsi-position": `${rsiPosition}%` } as CSSProperties} role="img" aria-label={`RSI14 ${number(rsi)}，${rsiLabel}`}><i /></div>
        <div className="rsi-labels"><span>偏冷参考 30</span><b>{rsiLabel}</b><span>偏热参考 70</span></div>
      </div>
      <div className="visual-card bollinger-visual">
        <div className="visual-card-heading">
          <div><span>价格在近期通道哪里</span><div className="heading-with-help"><strong><MetricLabel metric="bollinger">布林带（BOLL）</MetricLabel></strong></div></div>
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
          <span><b>{bollState}</b><small>{bollinger.bandwidthPercentile === null ? `已有 ${bollinger.sampleSize} 个读数，仍在积累` : `当前宽度高于或等于约 ${bollinger.bandwidthPercentile}% 的已有读数`}</small></span>
          <span><b>{bollinger.percentB === null ? "带内位置 —" : `带内位置 ${number(bollinger.percentB, 2)}`}</b><small>通道宽度 {percent(bollinger.bandwidth)} · 近20日实际波动 {percent(realizedVolatility)}</small></span>
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
  const rsiState = rsi === null ? "数据不足" : rsi >= 70 ? "近期偏热" : rsi <= 30 ? "近期偏冷" : rsi >= 55 ? "近期偏强" : rsi <= 45 ? "近期偏弱" : "近期中性";
  const pricingState = ratio === null ? "数据不足" : ratio >= 1.2 ? "期权预估更高" : ratio <= 0.8 ? "期权预估更低" : "两者接近";

  return (
    <div className="visual-card momentum-information">
      <div className="visual-card-heading">
        <div><span>市场预计会晃多大</span><strong>期权预估与近期实际波动</strong></div>
        <small>只比较波动大小，不判断涨跌</small>
      </div>
      <div className="volatility-bars" role="img" aria-label={`近20日实际波动 ${percent(realizedVolatility)}，期权预估波动 ${percent(atmIv)}`}>
        <div><MetricLabel metric="rv20">近20日实际波动</MetricLabel><b>{percent(realizedVolatility)}</b><i><em style={{ width: `${((realizedVolatility ?? 0) / maxVol) * 100}%` }} /></i></div>
        <div><MetricLabel metric="atmIv">期权预估波动（ATM IV）</MetricLabel><b>{percent(atmIv)}</b><i><em className="implied" style={{ width: `${((atmIv ?? 0) / maxVol) * 100}%` }} /></i></div>
      </div>
      <div className="momentum-info-grid">
        <article><span>最近涨跌力度</span><strong>{rsiState}</strong><p>RSI 为 {number(rsi)}；70以上偏热，30以下偏冷，中间区域用来观察强弱变化。</p></article>
        <article><span>近期一天通常晃多大</span><strong>{dailyProxy === null ? "—" : `约 ±${percent(dailyProxy)}`}</strong><p>由近20日实际波动折算，只是历史参考，不是明天的预测范围。</p></article>
        <article><span>期权预估比过去高还是低</span><strong>{pricingState}</strong><p>{ratio === null ? "需要同时有期权预估和近20日实际波动。" : `期权预估是近期实际波动的 ${ratio.toFixed(2)} 倍，相差 ${spread! >= 0 ? "+" : ""}${(spread! * 100).toFixed(1)} 个百分点。`}</p></article>
      </div>
      <small>高低只是相对比较，不等于期权一定贵或便宜；到期时间和事件风险也会影响价格。</small>
    </div>
  );
}

export function ExpectedRangeVisual({
  close,
  lower,
  upper,
  expectedMove,
  expectedMovePct,
  expiration,
  maxPain,
  callWall,
  putWall,
}: {
  close: number;
  lower: NullableNumber;
  upper: NullableNumber;
  expectedMove: NullableNumber;
  expectedMovePct: NullableNumber;
  expiration: string | null;
  maxPain: NullableNumber;
  callWall: NullableNumber;
  putWall: NullableNumber;
}) {
  const points = [
    { label: "期权估算下沿", value: lower, className: "lower" },
    { label: "期权估算上沿", value: upper, className: "upper" },
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
        <div><MetricLabel metric="expectedRange">最近到期期权估算区间</MetricLabel><strong>{expectedMove === null ? "暂无数据" : `上下各 ${money(expectedMove)}`}</strong><small>{expiration ? `对应到期日 ${expiration}` : "暂无可用到期日"}</small></div>
        <b>{expectedMovePct === null ? "—" : `± ${percent(expectedMovePct)}`}</b>
      </div>
      {lower === null || upper === null ? <div className="mini-empty">暂时无法计算期权估算区间</div> : <>
        <div className="range-plot" role="img" aria-label={`期权估算区间 ${money(lower)} 至 ${money(upper)}，并标出现价、最大痛点、看涨墙和看跌墙`}>
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
        <div><MetricLabel metric="putCallOi">Call 和 Put 哪边更多</MetricLabel><strong>未结束期权合约占比</strong></div>
        <b>{number(ratio)} <small>Put ÷ Call</small></b>
      </div>
      <div className="put-call-bar" role="img" aria-label={`Call 占 ${Math.round(callShare * 100)}%，Put 占 ${Math.round(putShare * 100)}%`}>
        <i className="call" style={{ width: `${callShare * 100}%` }} />
        <i className="put" style={{ width: `${putShare * 100}%` }} />
      </div>
      <div className="put-call-sides">
        <div className="call"><span>Call</span><strong>{Math.round(callShare * 100)}%</strong><small>占全部未平仓量</small></div>
        <div className="put"><span>Put</span><strong>{Math.round(putShare * 100)}%</strong><small>占全部未平仓量</small></div>
      </div>
      <small className="put-call-note">最近到期期权预估波动（ATM IV）{percent(atmIv)}</small>
    </div>
  );
}
