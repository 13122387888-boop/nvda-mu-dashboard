import { money, percent } from "@/lib/format";
import type { OptionHistoryPoint, ExpectedRangeValidation } from "@/lib/indicators/options/option-research";

type Series = { key: keyof OptionHistoryPoint; label: string; color: string; dashed?: boolean };

function ResearchLineChart({ points, series, percentValues = false }: { points: OptionHistoryPoint[]; series: Series[]; percentValues?: boolean }) {
  const width = 720;
  const height = 240;
  const padding = { left: 30, right: 22, top: 22, bottom: 30 };
  const values = points.flatMap((point) => series.map((item) => point[item.key])).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!values.length) return <div className="chart-empty compact">当前快照没有可绘制的历史数值。</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, Math.abs(max) * 0.08, 0.01);
  const x = (index: number) => padding.left + (points.length <= 1 ? (width - padding.left - padding.right) / 2 : index / (points.length - 1) * (width - padding.left - padding.right));
  const y = (value: number) => padding.top + (max - value) / range * (height - padding.top - padding.bottom);
  const formatValue = (value: number) => percentValues ? `${(value * 100).toFixed(1)}%` : money(value);
  return (
    <div className="research-line-chart">
      <div className="research-chart-legend">{series.map((item) => <span key={String(item.key)}><i style={{ background: item.color }} />{item.label}</span>)}</div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={series.map((item) => item.label).join("、") + "历史变化"}>
        {[0, 0.5, 1].map((ratio) => {
          const gridY = padding.top + ratio * (height - padding.top - padding.bottom);
          const value = max - ratio * range;
          return <g key={ratio}><line x1={padding.left} x2={width - padding.right} y1={gridY} y2={gridY} className="history-grid" /><text x={padding.left} y={gridY - 5}>{formatValue(value)}</text></g>;
        })}
        {series.map((item) => {
          const coordinates = points.map((point, index) => ({ value: point[item.key], x: x(index) })).filter((row): row is { value: number; x: number } => typeof row.value === "number");
          return <g key={String(item.key)}><polyline points={coordinates.map((row) => `${row.x},${y(row.value)}`).join(" ")} fill="none" stroke={item.color} strokeWidth="2.5" strokeDasharray={item.dashed ? "6 5" : undefined} />{coordinates.map((row) => <circle key={`${row.x}-${row.value}`} cx={row.x} cy={y(row.value)} r="3.5" fill={item.color} />)}</g>;
        })}
        {points.map((point, index) => (index === 0 || index === points.length - 1 || index % Math.max(1, Math.ceil(points.length / 5)) === 0) && <text key={point.date} x={x(index)} y={height - 8} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}>{point.date.slice(5)}</text>)}
      </svg>
    </div>
  );
}

function ValidationSample({ sample }: { sample: ExpectedRangeValidation }) {
  return <div className="validation-sample"><span>{sample.forecastDate.slice(5)} → {sample.expiration.slice(5)}</span><b className={sample.closedInside ? "positive" : "warning-text"}>{sample.closedInside ? "收盘在区间内" : "收盘越出区间"}</b><small>{money(sample.expectedLower)} — {money(sample.expectedUpper)} · 到期 {money(sample.expirationClose)}</small></div>;
}

export function OptionStructureHistory({ history }: { history: { points: OptionHistoryPoint[]; validation: { sampleSize: number; insideCount: number; insideRate: number | null; upperTouchCount: number; lowerTouchCount: number; samples: ExpectedRangeValidation[] } } }) {
  const usefulPoints = history.points.filter((point) => point.callWall !== null || point.atmIv !== null);
  if (!usefulPoints.length) return <div className="chart-empty">期权历史快照正在积累，暂时没有可绘制的结构变化。</div>;
  return (
    <div className="option-history-stack">
      <article className="research-chart-card">
        <div className="research-chart-heading"><div><span>墙位演变</span><h3>价格与墙位是否一起移动</h3></div><b>{usefulPoints.length} 个快照</b></div>
        <ResearchLineChart points={usefulPoints} series={[
          { key: "close", label: "收盘价", color: "#f3f6fb" },
          { key: "callWall", label: "看涨墙", color: "#57d68d" },
          { key: "putWall", label: "看跌墙", color: "#ff667d" },
          { key: "maxPain", label: "最大痛点", color: "#f2b84b", dashed: true },
        ]} />
        <p>墙位来自每个快照内未平仓量最大的行权价。快照较少时只说明结构变化，不能视为稳定趋势。</p>
      </article>
      <article className="research-chart-card">
        <div className="research-chart-heading"><div><span>波动率演变</span><h3>期权定价与实际波动的差</h3></div><b>{usefulPoints.filter((point) => point.atmIv !== null).length} 个 IV 样本</b></div>
        <ResearchLineChart points={usefulPoints} percentValues series={[
          { key: "atmIv", label: "平值 IV", color: "#b987ff" },
          { key: "rv20", label: "20日实际波动", color: "#55a7ff", dashed: true },
        ]} />
        <p>IV 是最近到期合约的隐含波动率，RV20 是此前 20 个交易日的年化实际波动；两者期限并不完全一致。</p>
      </article>
      <article className="range-validation-card">
        <div className="research-chart-heading"><div><span>区间复盘</span><h3>历史预期区间到期验证</h3></div><b>{history.validation.sampleSize} 个到期样本</b></div>
        {history.validation.sampleSize === 0 ? <div className="sample-building"><strong>样本积累中</strong><span>当前快照对应的到期日尚未结束，暂不计算“命中率”。</span></div> : <>
          <div className="validation-metrics"><div><span>到期收盘在区间内</span><strong>{percent(history.validation.insideRate)}</strong><small>{history.validation.insideCount} / {history.validation.sampleSize}</small></div><div><span>期间触及上沿</span><strong>{history.validation.upperTouchCount}</strong><small>仅描述是否触及</small></div><div><span>期间触及下沿</span><strong>{history.validation.lowerTouchCount}</strong><small>仅描述是否触及</small></div></div>
          <div className="validation-samples">{history.validation.samples.map((sample) => <ValidationSample key={`${sample.forecastDate}-${sample.expiration}`} sample={sample} />)}</div>
        </>}
        <div className="research-method-note"><b>口径</b>以快照当日收盘价和最近到期平值 IV 推算区间，再用该到期日前最后一个交易日收盘验证。样本可能重叠且数量有限，历史命中率不是未来概率。</div>
      </article>
    </div>
  );
}
