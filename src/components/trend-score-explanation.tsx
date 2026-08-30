import { percent } from "@/lib/format";
import {
  TREND_SCORE_VOLUME_THRESHOLDS,
  TREND_SCORE_WEIGHTS,
  type TrendScoreBreakdown,
} from "@/lib/indicators/stock-metrics";

function signedContribution(value: number) {
  const rounded = Number(value.toFixed(1));
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}`;
}

function contributionTone(value: number) {
  if (value > 0.05) return "positive";
  if (value < -0.05) return "negative";
  return "neutral";
}

function volumeSummary(volume: TrendScoreBreakdown["volumeConfirmation"]) {
  if (volume.relativeVolume === null || volume.dailyChangePct === null) return "成交量或前一日收盘数据不足，本项按 0 分处理";
  if (Math.abs(volume.dailyChangePct) < TREND_SCORE_VOLUME_THRESHOLDS.dailyMoveDeadZonePct) {
    return `当日 ${percent(volume.dailyChangePct, true)}，处于 ±${TREND_SCORE_VOLUME_THRESHOLDS.dailyMoveDeadZonePct}% 噪声区间`;
  }
  if (volume.relativeVolume <= TREND_SCORE_VOLUME_THRESHOLDS.baselineRelativeVolume) {
    return `量能 ${volume.relativeVolume.toFixed(1)}×，没有高于此前 20 日均量`;
  }
  return `量能 ${volume.relativeVolume.toFixed(1)}× · 当日 ${volume.dailyChangePct >= 0 ? "+" : ""}${percent(volume.dailyChangePct, true)}`;
}

function ScorePart({
  label,
  value,
  maximum,
  description,
  unavailable = false,
}: {
  label: string;
  value: number;
  maximum: number;
  description: string;
  unavailable?: boolean;
}) {
  return (
    <article className={contributionTone(value)}>
      <span>{label}</span>
      <div className="trend-score-part-value"><strong>{unavailable ? "未参与" : signedContribution(value)}</strong><em>/ {maximum}</em></div>
      <small>{description}</small>
    </article>
  );
}

export function TrendScoreExplanation({ breakdown }: { breakdown: TrendScoreBreakdown }) {
  const equation = [
    breakdown.base,
    breakdown.pricePosition.total,
    breakdown.alignment.total,
    breakdown.momentum.contribution,
    breakdown.volumeConfirmation.contribution,
  ];

  return (
    <div className="trend-score-explanation">
      <div className="trend-score-equation" aria-label={`中性起点 ${breakdown.base} 分，加上四项贡献后为 ${breakdown.score} 分`}>
        <span><small>中性起点</small><b>{breakdown.base}</b></span>
        <i>+</i>
        <span><small>四项合计</small><b>{signedContribution(equation.slice(1).reduce((sum, value) => sum + value, 0))}</b></span>
        <i>=</i>
        <span className="total"><small>趋势分</small><b>{breakdown.score}</b></span>
      </div>

      <div className="trend-score-parts trend-score-sheet-parts">
        <ScorePart
          label="均线位置"
          value={breakdown.pricePosition.total}
          maximum={TREND_SCORE_WEIGHTS.pricePosition}
          description="现价相对 50、100、200 日线的位置，长期均线权重更高"
        />
        <ScorePart
          label="均线排列"
          value={breakdown.alignment.total}
          maximum={TREND_SCORE_WEIGHTS.alignment}
          description="比较 50/100 日线和 100/200 日线的先后顺序"
        />
        <ScorePart
          label="近期强弱（RSI）"
          value={breakdown.momentum.contribution}
          maximum={TREND_SCORE_WEIGHTS.momentum}
          description={breakdown.momentum.rsi14 === null ? "RSI 数据不足，本项按 0 分处理" : `当前 RSI ${breakdown.momentum.rsi14.toFixed(1)}，50 为中性`}
          unavailable={breakdown.momentum.rsi14 === null}
        />
        <ScorePart
          label="量价确认"
          value={breakdown.volumeConfirmation.contribution}
          maximum={TREND_SCORE_WEIGHTS.volumeConfirmation}
          description={volumeSummary(breakdown.volumeConfirmation)}
          unavailable={breakdown.volumeConfirmation.relativeVolume === null || breakdown.volumeConfirmation.dailyChangePct === null}
        />
      </div>

      <div className="trend-score-method">
        <div className="trend-score-method-heading"><span>计算口径</span><small>权重、阈值和缺失数据处理</small></div>
        <dl>
          <div><dt>总分</dt><dd>从 50 分开始，加上均线位置、均线排列、RSI 和量价确认四项贡献，结果限制在 0–100。</dd></div>
          <div><dt>均线位置 · 25分</dt><dd>现价相对 MA50、MA100、MA200 的偏离分别使用 5、8、12 分权重；偏离达到约 12%、18%、25% 时相应项封顶。缺少某条均线时，可用均线的权重按比例归一到 25 分。</dd></div>
          <div><dt>均线排列 · 10分</dt><dd>比较 MA50 与 MA100、MA100 与 MA200：快线在慢线上方加分，反之减分。两组都可比较时各占 5 分；只有一组时该组按 10 分计算。</dd></div>
          <div><dt>RSI · 10分</dt><dd>RSI 50 对应 0 分；从 50 到 70 线性增加至 +10，从 50 到 30 线性减少至 -10，超出 30/70 后保持封顶。</dd></div>
          <div><dt>量价确认 · 5分</dt><dd>相对成交量（RVOL）为当日成交量 ÷ 此前 20 日均量。当日涨跌小于 ±0.2% 或 RVOL 不高于 1× 时计 0 分；RVOL 从 1× 到 2× 线性扩大，放量上涨加分、放量下跌减分，2× 及以上封顶为 ±5。</dd></div>
          <div><dt>数据不足</dt><dd>至少需要两条可用均线才计算总分；RSI、成交量或前一日收盘缺失时，相应项目按 0 分处理，并在对应项目标注“未参与”。</dd></div>
        </dl>
      </div>

      <p className="trend-score-sheet-note">趋势分用于比较价格结构和量价配合，不是上涨概率、目标价或买卖建议。</p>
    </div>
  );
}
