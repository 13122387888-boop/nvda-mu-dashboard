import type { CSSProperties } from "react";
import { BriefLink } from "@/components/brief-link";
import { MetricLabel } from "@/components/metric-help";
import { buildObservationScenarios, buildResearchBrief, type DecisionSupportInput, type ScenarioInput } from "@/lib/indicators/decision-support";
import { money, percent } from "@/lib/format";

type KeyLevels = {
  callWall: number | null;
  putWall: number | null;
  maxPain: number | null;
  expectedUpper: number | null;
  expectedLower: number | null;
};

function nearestKeyLevel(close: number, levels: KeyLevels) {
  return [
    { label: "看涨墙", value: levels.callWall },
    { label: "看跌墙", value: levels.putWall },
    { label: "最大痛点", value: levels.maxPain },
    { label: "预期上沿", value: levels.expectedUpper },
    { label: "预期下沿", value: levels.expectedLower },
  ].filter((item): item is { label: string; value: number } => item.value !== null && Number.isFinite(item.value))
    .map((item) => ({ ...item, delta: (item.value - close) / close }))
    .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0] ?? null;
}

export function DataScope({
  stockDate,
  optionsDate,
  expiration,
  optionWindow,
  strikeCount,
  stockProviders,
}: {
  stockDate: string;
  optionsDate: string | null;
  expiration: string | null;
  optionWindow: string;
  strikeCount: number;
  stockProviders: string[];
}) {
  return (
    <section className="data-scope" aria-label="数据口径">
      <div className="scope-tags">
        <span><b>股票日终</b>{stockDate}</span>
        <span><b>期权日终</b>{optionsDate ?? "暂无"}</span>
        <span><b>期权期限</b>{optionWindow}</span>
      </div>
      <details>
        <summary>数据口径与限制</summary>
        <div className="scope-grid">
          <div><b>股票行情</b><p>采用调整后日线数据计算涨跌、MA50/100/200、RSI14 与 RV20。当前数据源：{stockProviders.map((provider) => provider === "ONCLICKMEDIA" ? "OnclickMedia" : provider === "LONGBRIDGE" ? "长桥" : provider).join(" + ")}。页面不是盘中实时行情。</p></div>
          <div><b>期权范围</b><p>使用最新可取得的日终期权链。看涨墙、看跌墙、未平仓量比（Put/Call）、OI 与 Gamma 在“{optionWindow}”内汇总；当前覆盖{strikeCount ? `${strikeCount} 个近价行权价` : "暂无可用行权价"}。</p></div>
          <div><b>模型指标</b><p>预期区间、平值隐含波动率（ATM IV）与最大痛点采用所选范围内最近到期日 {expiration ?? "暂无"}；Gamma 统一按看涨（Call）为正、看跌（Put）为负计算结构代理。</p></div>
          <div><b>使用边界</b><p>规则观察未纳入盘中变化、财报新闻、交易成本、个人持仓及风险承受能力，仅用于研究展示。</p></div>
        </div>
      </details>
    </section>
  );
}

export function ResearchOverview({
  input,
  close,
  trendScore,
  confidence,
  stockDate,
  levels,
  relativeVolume,
  ivPercentile,
}: {
  input: DecisionSupportInput;
  close: number;
  trendScore: number | null;
  confidence: { level: "HIGH" | "MEDIUM" | "LOW"; label: string; reason: string };
  stockDate: string;
  levels: KeyLevels;
  relativeVolume: number | null;
  ivPercentile: { percentile: number | null; label: string };
}) {
  const brief = buildResearchBrief(input);
  const nearest = nearestKeyLevel(close, levels);
  const nearestPosition = !nearest ? "暂无可用期权关键位" : Math.abs(nearest.delta) < 0.0005
    ? "与现价基本重合"
    : `${nearest.delta > 0 ? "现价上方" : "现价下方"} ${percent(Math.abs(nearest.delta))}`;
  const gammaLabel = input.gammaRegime === "POSITIVE" ? "波动偏收敛（正 Gamma）" : input.gammaRegime === "NEGATIVE" ? "波动易放大（负 Gamma）" : input.gammaRegime === "NEUTRAL" ? "波动机制中性" : "Gamma 暂无";
  const volumeLabel = relativeVolume === null ? "量能暂无" : relativeVolume >= 1.5 ? `成交活跃 ${relativeVolume.toFixed(1)}×` : relativeVolume <= 0.7 ? `成交偏淡 ${relativeVolume.toFixed(1)}×` : `成交常态 ${relativeVolume.toFixed(1)}×`;
  const trendLabel = trendScore === null ? "趋势暂无" : trendScore >= 60 ? `走势偏强（${trendScore}/100）` : trendScore <= 40 ? `走势偏弱（${trendScore}/100）` : `走势中性（${trendScore}/100）`;
  const ivPositionLabel = ivPercentile.percentile === null ? ivPercentile.label : `${ivPercentile.percentile >= 70 ? "定价偏高" : ivPercentile.percentile <= 30 ? "定价偏低" : "定价中位"}（${ivPercentile.percentile}%分位）`;
  const trendTone = brief.items[0].tone;
  const volatilityState = brief.items[2].state;
  const trendVerdict = trendScore === null ? "neutral"
    : trendTone === "positive" ? (trendScore >= 55 ? "support" : "conflict")
      : trendTone === "negative" ? (trendScore <= 45 ? "support" : "conflict")
        : trendScore >= 45 && trendScore <= 55 ? "support" : "neutral";
  const volumeVerdict = relativeVolume === null ? "neutral" : relativeVolume >= 1.5 ? "support" : relativeVolume <= 0.7 ? "conflict" : "neutral";
  const gammaVerdict = input.gammaRegime === "UNAVAILABLE" || input.gammaRegime === "NEUTRAL" ? "neutral"
    : trendTone === "neutral" ? (input.gammaRegime === "POSITIVE" ? "support" : "conflict")
      : input.gammaRegime === "NEGATIVE" ? "support" : "neutral";
  const ivVerdict = ivPercentile.percentile === null ? "neutral"
    : volatilityState === "隐含波动较高" ? (ivPercentile.percentile >= 70 ? "support" : ivPercentile.percentile <= 30 ? "conflict" : "neutral")
      : volatilityState === "隐含波动较低" ? (ivPercentile.percentile <= 30 ? "support" : ivPercentile.percentile >= 70 ? "conflict" : "neutral")
        : ivPercentile.percentile >= 30 && ivPercentile.percentile <= 70 ? "support" : "neutral";
  const evidence = [
    { label: "趋势", value: trendLabel, verdict: trendVerdict, targetId: "price-trend" },
    { label: "量能", value: volumeLabel, verdict: volumeVerdict, targetId: "price-chart" },
    { label: "Gamma", value: gammaLabel, verdict: gammaVerdict, targetId: "options-gamma" },
    { label: "IV位置", value: ivPositionLabel, verdict: ivVerdict, targetId: "momentum-pricing" },
  ] as const;
  const verdictLabels = { support: "一致", neutral: "补充", conflict: "需复核" } as const;
  const verdictIcons = { support: "✓", neutral: "·", conflict: "!" } as const;
  const evidenceCounts = evidence.reduce((counts, item) => ({ ...counts, [item.verdict]: counts[item.verdict] + 1 }), { support: 0, neutral: 0, conflict: 0 });
  const availableEvidence = evidence.filter((item) => !item.value.includes("暂无") && !item.value.includes("积累中") && !item.value.startsWith("—")).length;
  return (
    <section className={`research-overview tone-${brief.items[0].tone}`} aria-labelledby="research-overview-title">
      <div className="overview-heading"><span>首屏研究摘要</span><b>日终数据 · {stockDate}</b></div>
      <div className="overview-decision-grid">
        <article className="decision-conclusion"><span>01 结论</span><h2 id="research-overview-title">{brief.summary}</h2><small>趋势数据完整度 {confidence.label} · {confidence.reason}</small></article>
        <article className="decision-evidence"><span>02 依据</span><div className="evidence-summary"><strong>{evidenceCounts.support}/{availableEvidence || evidence.length} 条依据与结论一致</strong><small>{evidenceCounts.support}一致 · {evidenceCounts.neutral}补充 · {evidenceCounts.conflict}需复核</small></div><div className="evidence-balance" aria-label="依据一致性分布">{evidence.map((item) => <i className={`evidence-${item.verdict}`} key={item.label} />)}</div><div className="evidence-grid">{evidence.map((item) => <BriefLink targetId={item.targetId} hint="查看 →" className={`evidence-item evidence-${item.verdict}`} key={item.label}><div><span>{item.label}</span><em>{verdictIcons[item.verdict]} {verdictLabels[item.verdict]}</em></div><strong>{item.value}</strong></BriefLink>)}</div><small className="evidence-legend">一致＝强化当前摘要 · 需复核＝存在相反信息；Gamma 只描述波动机制，不判断涨跌。</small></article>
        <article className="decision-observation">
          <span>03 现在先看</span>
          <div className="overview-reading-path">
            <BriefLink targetId="price-trend" className="overview-path-step" hint="查看 →"><b>1</b><span>方向</span><strong>{trendLabel}</strong></BriefLink>
            <BriefLink targetId="price-distance" className="overview-path-step" hint="查看 →"><b>2</b><span>位置</span><strong>{nearest ? `${nearest.label} · ${nearestPosition}` : "关键价位数据不足"}</strong></BriefLink>
            <BriefLink targetId={input.gammaRegime === "UNAVAILABLE" ? "momentum-pricing" : "options-gamma"} className="overview-path-step" hint="查看 →"><b>3</b><span>波动</span><strong>{gammaLabel}</strong></BriefLink>
          </div>
        </article>
      </div>
      <footer><span>回答当前结构与观察条件，不预测下一交易日必然涨跌。</span></footer>
    </section>
  );
}

export function ResearchBrief({ input }: { input: DecisionSupportInput }) {
  const brief = buildResearchBrief(input);
  const targets: Record<string, string> = {
    "趋势": "price-trend",
    "动量": "momentum-overview",
    "波动定价": "momentum-pricing",
    "期权结构": "options-gamma",
  };
  return (
    <section className="research-brief" aria-labelledby="research-brief-title">
      <div className="brief-heading">
        <div><span>快速摘要</span><h2 id="research-brief-title">30秒研究简报</h2></div>
        <b>规则观察</b>
      </div>
      <p className="brief-summary">{brief.summary}</p>
      <div className="brief-action-hint"><b>可点击</b><span>选择任一摘要，直接定位到对应依据</span></div>
      <div className="brief-grid">
        {brief.items.map((item) => (
          <BriefLink targetId={targets[item.label]} className={`brief-item ${item.tone}`} key={item.label}>
            <span>{item.label}</span><strong>{item.state}</strong><p>{item.detail}</p>
          </BriefLink>
        ))}
      </div>
      <small>只描述当前公开日终数据 · 数据变化后结论会重新计算</small>
    </section>
  );
}

type NullableNumber = number | null;

export function KeyDistanceMap({
  close,
  callWall,
  putWall,
  maxPain,
  expectedUpper,
  expectedLower,
  expectedMove,
}: {
  close: number;
  callWall: NullableNumber;
  putWall: NullableNumber;
  maxPain: NullableNumber;
  expectedUpper: NullableNumber;
  expectedLower: NullableNumber;
  expectedMove: NullableNumber;
}) {
  const levels = [
    { label: "看跌墙", value: putWall, className: "put-wall" },
    { label: "预期下沿", value: expectedLower, className: "range-edge" },
    { label: "最大痛点", value: maxPain, className: "max-pain" },
    { label: "现价", value: close, className: "spot" },
    { label: "预期上沿", value: expectedUpper, className: "range-edge" },
    { label: "看涨墙", value: callWall, className: "call-wall" },
  ].filter((level): level is { label: string; value: number; className: string } => level.value !== null && Number.isFinite(level.value));
  const ordered = [...levels].sort((a, b) => a.value - b.value);
  const rawMin = Math.min(...ordered.map((level) => level.value));
  const rawMax = Math.max(...ordered.map((level) => level.value));
  const rawSpan = Math.max(rawMax - rawMin, close * 0.04);
  const min = rawMin - rawSpan * 0.08;
  const max = rawMax + rawSpan * 0.08;
  const position = (value: number) => `${((value - min) / (max - min)) * 100}%`;
  const relative = (value: NullableNumber) => value === null ? "—" : percent((value - close) / close);
  const expectedPct = expectedMove === null ? "—" : `±${percent(expectedMove / close)}`;

  return (
    <section className="visual-card key-distance-card" aria-labelledby="key-distance-title">
      <div className="visual-card-heading">
        <div><span>关键价位距离</span><strong id="key-distance-title">关键距离图</strong></div>
        <small>全部数值均相对当前收盘价</small>
      </div>
      <div className="level-map-scroll">
        <div className="level-map" role="img" aria-label="现价、预期区间、最大痛点、看涨墙和看跌墙价格位置图">
          <i className="level-axis" />
          {ordered.map((level, index) => (
            <div className={`level-pin ${level.className} tier-${index % 3}`} style={{ "--level-left": position(level.value) } as CSSProperties} key={level.label}>
              <span>{level.label}</span><b>{money(level.value)}</b><i />
            </div>
          ))}
          <span className="level-bound lower">{money(rawMin)}</span><span className="level-bound upper">{money(rawMax)}</span>
        </div>
      </div>
      <div className="level-ladder" aria-label="关键价位完整列表">
        {[...ordered].reverse().map((level) => <div className={level.className} key={level.label}><i /><span>{level.label}</span><b>{money(level.value)}</b><small>{level.label === "现价" ? "基准" : relative(level.value)}</small></div>)}
      </div>
      <div className="distance-grid">
        <div><MetricLabel metric="callWall">看涨墙相对现价</MetricLabel><strong>{relative(callWall)}</strong><small>{money(callWall)}</small></div>
        <div><MetricLabel metric="putWall">看跌墙相对现价</MetricLabel><strong>{relative(putWall)}</strong><small>{money(putWall)}</small></div>
        <div><MetricLabel metric="maxPain">最大痛点相对现价</MetricLabel><strong>{relative(maxPain)}</strong><small>{money(maxPain)}</small></div>
        <div><MetricLabel metric="expectedRange">到期预期波动</MetricLabel><strong>{expectedPct}</strong><small>{expectedMove === null ? "—" : `±${money(expectedMove)}`}</small></div>
      </div>
    </section>
  );
}

export function ScenarioObservation({ input }: { input: ScenarioInput }) {
  const scenarios = buildObservationScenarios(input);
  return (
    <section className="scenario-section" aria-labelledby="scenario-title">
      <div className="scenario-heading">
        <div><span>条件观察</span><h3 id="scenario-title">情景观察卡</h3></div>
        <p>先看条件是否成立，再看其他指标是否共振。</p>
      </div>
      <div className="scenario-grid">
        {scenarios.map((scenario) => (
          <article className={`scenario-card ${scenario.tone}`} key={scenario.label}>
            <span>{scenario.label}</span><h4>{scenario.title}</h4>
            <dl>
              <div><dt>触发条件</dt><dd>{scenario.condition}</dd></div>
              <div><dt>辅助解读</dt><dd>{scenario.observation}</dd></div>
              <div><dt>重新判断</dt><dd>{scenario.invalidation}</dd></div>
            </dl>
          </article>
        ))}
      </div>
      <small>基于日终数据的条件观察，未纳入财报、新闻、盘中流动性和个人风险承受能力。</small>
    </section>
  );
}
