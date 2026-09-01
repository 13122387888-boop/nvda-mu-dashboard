import type { CSSProperties } from "react";
import { BriefLink } from "@/components/brief-link";
import { MetricLabel } from "@/components/metric-help";
import type { OptionDataQuality } from "@/lib/data-quality";
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
    { label: "期权估算上沿", value: levels.expectedUpper },
    { label: "期权估算下沿", value: levels.expectedLower },
  ].filter((item): item is { label: string; value: number } => item.value !== null && Number.isFinite(item.value))
    .map((item) => ({ ...item, delta: (item.value - close) / close }))
    .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0] ?? null;
}

export function DataScope({
  stockDate,
  optionsDate,
  optionFreshness,
  expiration,
  optionWindow,
  strikeCount,
  stockProviders,
  optionQuality,
}: {
  stockDate: string;
  optionsDate: string | null;
  optionFreshness: {
    status: "CURRENT" | "HISTORICAL" | "UNAVAILABLE";
    isCurrent: boolean;
    ageBusinessDays: number | null;
    reason: string;
  };
  expiration: string | null;
  optionWindow: string;
  strikeCount: number;
  stockProviders: string[];
  optionQuality: OptionDataQuality;
}) {
  const upstreamCoverage = optionQuality.stats.upstreamCoverage;
  const coverageText = upstreamCoverage
    ? `上游返回 ${upstreamCoverage.returned}/${upstreamCoverage.available} 个“到期日 × 行权价”组合（约 ${(upstreamCoverage.ratio * 100).toFixed(1)}%）`
    : "上游提供现价附近的部分行权价，并非完整期权链";
  const recentSnapshotNote = optionFreshness.isCurrent && (optionFreshness.ageBusinessDays ?? 0) > 0
    ? `当前使用 ${optionsDate} 的最近可用快照，较股票数据早 ${optionFreshness.ageBusinessDays} 个工作日；ATM、波动区间和 Gamma 均按快照日收盘价计算。`
    : "";
  return (
    <section className="data-scope" aria-label="数据日期和计算方法">
      <div className="scope-tags">
        <span><b>股票数据</b>{stockDate}</span>
        <span><b>期权数据</b>{optionsDate ?? "暂无"}</span>
        <span><b>统计范围</b>{optionWindow}</span>
        <span className={optionFreshness.isCurrent ? "scope-quality-limited" : "scope-quality-missing"}><b>期权状态</b>{optionFreshness.isCurrent ? optionFreshness.ageBusinessDays === 0 ? "同日有限样本" : "最近有限样本" : optionFreshness.status === "HISTORICAL" ? "历史快照" : "暂无"}</span>
      </div>
      <details>
        <summary>这些数据从哪里来、怎么算</summary>
        <div className="scope-grid">
          <div><b>价格和技术指标</b><p>使用调整后的日线价格和每日成交量，计算均线、RSI、布林带、相对成交量和过去20日实际波动。数据源：{stockProviders.map((provider) => provider === "ONCLICKMEDIA" ? "OnclickMedia" : provider === "LONGBRIDGE" ? "长桥" : provider).join(" + ")}。这里不是盘中实时行情。</p></div>
          <div><b>期权数据质量</b><p>{optionFreshness.status === "HISTORICAL" ? `${optionFreshness.reason}，因此只保留日期说明，不参与当前 Gamma、墙位、最大痛点或波动区间结论。` : optionsDate ? `${recentSnapshotNote}${coverageText}。全部未到期样本有 ${optionQuality.stats.recordCount} 条合约、${optionQuality.stats.expirationCount} 个到期日、${optionQuality.stats.strikeCount} 个不同价位；OI / IV / Gamma 字段覆盖分别为 ${optionQuality.stats.oiCoveragePct}% / ${optionQuality.stats.ivCoveragePct}% / ${optionQuality.stats.gammaCoveragePct}%。下方图表会再按你选择的期限筛选，因此墙位等指标是“可见样本估算”，可能与富途的完整链或实时口径不同。` : "当前没有可用期权快照；若该标的没有上市期权，页面只展示股票技术数据。"}</p></div>
          <div><b>墙位和持仓口径</b><p>{optionFreshness.isCurrent ? <>使用上方期权日期对应的数据；把“{optionWindow}”内相同行权价的未平仓量相加，Call 合计最多的位置叫看涨墙，Put 合计最多的位置叫看跌墙。图表显示{strikeCount ? `现价附近 ${strikeCount} 个行权价` : "暂无可用行权价"}，墙位不是确定的支撑或阻力。</> : "期权快照已超出允许时差，本次不计算墙位和持仓结论。"}</p></div>
          <div><b>区间和波动指标</b><p>{optionFreshness.isCurrent ? <>期权估算区间、期权预估波动（ATM IV）和最大痛点只使用最近到期日 {expiration ?? "暂无"}。Gamma 是按 Call 为正、Put 为负计算的结构估算，不是真实做市商持仓。</> : "期权快照不是当前同日数据，本次不计算 Gamma、最大痛点、ATM IV 和预期区间。"}</p></div>
          <div><b>没有考虑什么</b><p>页面没有纳入盘中变化、财报新闻、交易成本、个人持仓和风险承受能力，只描述最近收盘后的数据。</p></div>
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
}: {
  input: DecisionSupportInput;
  close: number;
  trendScore: number | null;
  confidence: { level: "HIGH" | "MEDIUM" | "LOW"; label: string; reason: string };
  stockDate: string;
  levels: KeyLevels;
}) {
  const brief = buildResearchBrief(input);
  const nearest = nearestKeyLevel(close, levels);
  const nearestPosition = !nearest ? "暂无可用期权关键位" : Math.abs(nearest.delta) < 0.0005
    ? "与现价基本重合"
    : `${nearest.delta > 0 ? "现价上方" : "现价下方"} ${percent(Math.abs(nearest.delta))}`;
  const trendLabel = trendScore === null ? "方向数据不足" : trendScore >= 60 ? `整体偏强（${trendScore}/100）` : trendScore <= 40 ? `整体偏弱（${trendScore}/100）` : `方向暂不明确（${trendScore}/100）`;
  const trendTone = brief.items[0].tone;
  const relationVerdict = (tone: typeof brief.items[number]["tone"], mechanismOnly = false) => {
    if (mechanismOnly || tone === "neutral") return "neutral" as const;
    if (tone === "warning") return "conflict" as const;
    if (trendTone === "positive") return tone === "positive" ? "support" as const : "conflict" as const;
    if (trendTone === "negative") return tone === "negative" ? "support" as const : "conflict" as const;
    return "neutral" as const;
  };
  const evidence = [
    { label: "大方向", value: `${brief.items[0].state}${trendScore === null ? "" : ` · ${trendScore}/100`}`, verdict: relationVerdict(brief.items[0].tone), available: trendScore !== null && input.marketStatus !== "INSUFFICIENT_DATA", targetId: "price-trend" },
    { label: "近期强弱", value: brief.items[1].state, verdict: relationVerdict(brief.items[1].tone), available: input.rsi14 !== null || input.bollinger.percentB !== null, targetId: "momentum-overview" },
    { label: "成交是否配合", value: `${brief.items[2].state}${input.relativeVolume === null ? "" : ` · ${input.relativeVolume.toFixed(1)}×`}`, verdict: relationVerdict(brief.items[2].tone), available: input.relativeVolume !== null, targetId: "price-chart" },
    { label: "期权波动环境", value: brief.items[3].state, verdict: relationVerdict(brief.items[3].tone, true), available: input.gammaRegime !== "UNAVAILABLE" || (input.atmIv !== null && input.rv20 !== null && input.rv20 > 0), targetId: "options-gamma" },
  ] as const;
  const verdictLabels = { support: "支持", neutral: "补充", conflict: "需留意" } as const;
  const verdictIcons = { support: "✓", neutral: "·", conflict: "!" } as const;
  const availableEvidence = evidence.filter((item) => item.available);
  const evidenceCounts = availableEvidence.reduce((counts, item) => ({ ...counts, [item.verdict]: counts[item.verdict] + 1 }), { support: 0, neutral: 0, conflict: 0 });
  return (
    <section className={`research-overview tone-${brief.items[0].tone}`} aria-labelledby="research-overview-title">
      <div className="overview-heading"><span>先看这三件事</span><b>截至 {stockDate} 收盘</b></div>
      <div className="overview-decision-grid">
        <article className="decision-conclusion"><span>01 现在怎么看</span><h2 id="research-overview-title">{brief.summary}</h2><small>趋势数据完整度：{confidence.label} · {confidence.reason}</small></article>
        <article className="decision-evidence"><span>02 为什么</span><div className="evidence-summary"><strong>{availableEvidence.length} 项依据中，{evidenceCounts.support} 项支持当前结论</strong><small>{evidenceCounts.support}支持 · {evidenceCounts.neutral}补充 · {evidenceCounts.conflict}需留意</small></div><div className="evidence-balance" aria-label="各项依据是否支持当前结论">{evidence.map((item) => <i className={`evidence-${item.available ? item.verdict : "unavailable"}`} key={item.label} />)}</div><div className="evidence-grid">{evidence.map((item) => <BriefLink targetId={item.targetId} hint="去看看 →" className={`evidence-item evidence-${item.available ? item.verdict : "unavailable"}`} key={item.label}><div><span>{item.label}</span><em>{item.available ? `${verdictIcons[item.verdict]} ${verdictLabels[item.verdict]}` : "· 等待数据"}</em></div><strong>{item.value}</strong></BriefLink>)}</div><small className="evidence-legend">“支持”表示与当前方向一致，“需留意”表示有过热、过冷或方向不一致等情况；Gamma 这里只比较 Call 与 Put 两侧的估算值，不判断涨跌，也不能确认波动一定如何变化。</small></article>
        <article className="decision-observation">
          <span>03 接下来先看</span>
          <div className="overview-reading-path">
            <BriefLink targetId="price-trend" className="overview-path-step" hint="去看看 →"><b>1</b><span>大方向</span><strong>{trendLabel}</strong></BriefLink>
            <BriefLink targetId="price-distance" className="overview-path-step" hint="去看看 →"><b>2</b><span>离关键位</span><strong>{nearest ? `${nearest.label} · ${nearestPosition}` : "关键价位数据不足"}</strong></BriefLink>
            <BriefLink targetId="momentum-overview" className="overview-path-step" hint="去看看 →"><b>3</b><span>短线是否配合</span><strong>{brief.items[1].state} · {brief.items[2].state}</strong></BriefLink>
          </div>
        </article>
      </div>
      <footer><span>这里只描述最近收盘后的状态，不代表下一个交易日一定上涨或下跌。</span></footer>
    </section>
  );
}

export function ResearchBrief({ input }: { input: DecisionSupportInput }) {
  const brief = buildResearchBrief(input);
  const targets: Record<string, string> = {
    "趋势": "price-trend",
    "短线状态": "momentum-overview",
    "量能": "price-chart",
    "期权环境": "options-gamma",
  };
  return (
    <section className="research-brief" aria-labelledby="research-brief-title">
      <div className="brief-heading">
        <div><span>快速看懂</span><h2 id="research-brief-title">30秒摘要</h2></div>
        <b>收盘后规则整理</b>
      </div>
      <p className="brief-summary">{brief.summary}</p>
      <div className="brief-action-hint"><b>可以点击</b><span>点任一项，直接查看对应数据</span></div>
      <div className="brief-grid">
        {brief.items.map((item) => (
          <BriefLink targetId={targets[item.label]} className={`brief-item ${item.tone}`} key={item.label}>
            <span>{item.label}</span><strong>{item.state}</strong><p>{item.detail}</p>
          </BriefLink>
        ))}
      </div>
      <small>只描述最近收盘后的数据；数据更新后会重新计算</small>
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
    { label: "期权估算下沿", value: expectedLower, className: "range-edge" },
    { label: "最大痛点", value: maxPain, className: "max-pain" },
    { label: "现价", value: close, className: "spot" },
    { label: "期权估算上沿", value: expectedUpper, className: "range-edge" },
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
        <div><span>现在离哪里最近</span><strong id="key-distance-title">现价与重点价位</strong></div>
        <small>正数在现价上方，负数在现价下方</small>
      </div>
      <div className="level-map-scroll">
        <div className="level-map" role="img" aria-label="现价、期权估算区间、最大痛点、看涨墙和看跌墙的位置">
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
        <div><MetricLabel metric="expectedRange">期权估算的上下波动</MetricLabel><strong>{expectedPct}</strong><small>{expectedMove === null ? "—" : `约 ±${money(expectedMove)}`}</small></div>
      </div>
    </section>
  );
}

export function ScenarioObservation({ input }: { input: ScenarioInput }) {
  const scenarios = buildObservationScenarios(input);
  return (
    <section className="scenario-section" aria-labelledby="scenario-title">
      <div className="scenario-heading">
        <div><span>如果价格到了关键位</span><h3 id="scenario-title">接下来观察什么</h3></div>
        <p>先等收盘满足条件，再看趋势和 Gamma 偏向是否变化。</p>
      </div>
      <div className="scenario-grid">
        {scenarios.map((scenario) => (
          <article className={`scenario-card ${scenario.tone}`} key={scenario.label}>
            <span>{scenario.label}</span><h4>{scenario.title}</h4>
            <dl>
              <div><dt>先满足</dt><dd>{scenario.condition}</dd></div>
              <div><dt>然后看</dt><dd>{scenario.observation}</dd></div>
              <div><dt>什么时候失效</dt><dd>{scenario.invalidation}</dd></div>
            </dl>
          </article>
        ))}
      </div>
      <small>这些条件只使用收盘后数据，没有考虑财报、新闻和盘中变化。</small>
    </section>
  );
}
