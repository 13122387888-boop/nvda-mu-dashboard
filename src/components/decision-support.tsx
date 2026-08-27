import type { CSSProperties } from "react";
import { BriefLink } from "@/components/brief-link";
import { MetricLabel } from "@/components/metric-help";
import { buildObservationScenarios, buildResearchBrief, type DecisionSupportInput, type ScenarioInput } from "@/lib/indicators/decision-support";
import { money, percent } from "@/lib/format";

export function DataScope({
  stockDate,
  optionsDate,
  expiration,
  optionWindow,
  strikeCount,
}: {
  stockDate: string;
  optionsDate: string | null;
  expiration: string | null;
  optionWindow: string;
  strikeCount: number;
}) {
  return (
    <section className="data-scope" aria-label="数据口径">
      <div className="scope-tags">
        <span><b>股票</b>EOD · {stockDate}</span>
        <span><b>期权</b>EOD · {optionsDate ?? "暂无"}</span>
        <span><b>期限</b>{optionWindow}</span>
        <span><b>定价到期</b>{expiration ?? "暂无"}</span>
        <span><b>覆盖</b>{strikeCount ? `${strikeCount} 个近价行权价` : "暂无期权链"}</span>
      </div>
      <details>
        <summary>查看数据口径与限制</summary>
        <div className="scope-grid">
          <div><b>股票行情</b><p>采用调整后日线数据计算涨跌、MA20/50/200、RSI14 与 RV20。页面不是盘中实时行情，周末、休市日及数据源发布前会停留在最近交易日。</p></div>
          <div><b>期权范围</b><p>使用最新可取得的日终期权链。看涨墙、看跌墙、Put/Call、未平仓量与 Gamma 在“{optionWindow}”内汇总；公开数据以有限近价行权价为主。</p></div>
          <div><b>模型指标</b><p>预期区间、ATM IV 与最大痛点采用所选范围内最近到期日，避免混合不同期限的价格；Gamma 统一按 Call 为正、Put 为负计算结构代理。</p></div>
          <div><b>使用边界</b><p>规则观察未纳入盘中变化、财报新闻、交易成本、个人持仓及风险承受能力，仅用于研究展示。</p></div>
        </div>
      </details>
    </section>
  );
}

export function ResearchBrief({ input }: { input: DecisionSupportInput }) {
  const brief = buildResearchBrief(input);
  const targets: Record<string, string> = {
    "趋势": "price-trend",
    "动量": "momentum-overview",
    "波动定价": "momentum-overview",
    "期权结构": "options-gamma",
  };
  return (
    <section className="research-brief" aria-labelledby="research-brief-title">
      <div className="brief-heading">
        <div><span>30 SEC RESEARCH BRIEF</span><h2 id="research-brief-title">30秒研究简报</h2></div>
        <b>规则观察</b>
      </div>
      <p className="brief-summary">{brief.summary}</p>
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
        <div><span>PRICE LEVEL DISTANCE</span><strong id="key-distance-title">关键距离图</strong></div>
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
        <div><span>CONDITIONAL OBSERVATIONS</span><h3 id="scenario-title">情景观察卡</h3></div>
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
