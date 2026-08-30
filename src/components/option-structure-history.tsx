import { money, percent } from "@/lib/format";
import type { OptionHistoryPoint, ExpectedRangeValidation, WallContinuationStats } from "@/lib/indicators/options/option-research";

type Series = { key: keyof OptionHistoryPoint; label: string; color: string; dashed?: boolean };

function ResearchLineChart({ points, series, percentValues = false }: { points: OptionHistoryPoint[]; series: Series[]; percentValues?: boolean }) {
  const width = 720;
  const height = 240;
  const padding = { left: 30, right: 22, top: 22, bottom: 30 };
  const values = points.flatMap((point) => series.map((item) => point[item.key])).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!values.length) return <div className="chart-empty compact">当前数据里没有可画出的历史数值。</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, Math.abs(max) * 0.08, 0.01);
  const x = (index: number) => padding.left + (points.length <= 1 ? (width - padding.left - padding.right) / 2 : index / (points.length - 1) * (width - padding.left - padding.right));
  const y = (value: number) => padding.top + (max - value) / range * (height - padding.top - padding.bottom);
  const formatValue = (value: number) => percentValues ? `${(value * 100).toFixed(1)}%` : money(value);
  const segmentsFor = (item: Series) => {
    const segments: Array<Array<{ value: number; x: number }>> = [];
    let current: Array<{ value: number; x: number }> = [];
    points.forEach((point, index) => {
      const value = point[item.key];
      if (typeof value === "number" && Number.isFinite(value)) current.push({ value, x: x(index) });
      else if (current.length) { segments.push(current); current = []; }
    });
    if (current.length) segments.push(current);
    return segments;
  };
  return (
    <div className="research-line-chart">
      <div className="research-chart-legend">{series.map((item) => <span key={String(item.key)}><i style={{ background: item.color }} />{item.label}</span>)}</div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={series.map((item) => item.label).join("、") + "历史变化"}>
        {[0, 0.5, 1].map((ratio) => {
          const gridY = padding.top + ratio * (height - padding.top - padding.bottom);
          const value = max - ratio * range;
          return <g key={ratio}><line x1={padding.left} x2={width - padding.right} y1={gridY} y2={gridY} className="history-grid" /><text x={padding.left} y={gridY - 5}>{formatValue(value)}</text></g>;
        })}
        {series.map((item) => <g key={String(item.key)}>{segmentsFor(item).map((segment, segmentIndex) => <polyline key={segmentIndex} points={segment.map((row) => `${row.x},${y(row.value)}`).join(" ")} fill="none" stroke={item.color} strokeWidth="2.5" strokeDasharray={item.dashed ? "6 5" : undefined} />)}{segmentsFor(item).flat().map((row) => <circle key={`${row.x}-${row.value}`} cx={row.x} cy={y(row.value)} r="3.5" fill={item.color} />)}</g>)}
        {points.map((point, index) => (index === 0 || index === points.length - 1 || index % Math.max(1, Math.ceil(points.length / 5)) === 0) && <text key={point.date} x={x(index)} y={height - 8} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}>{point.date.slice(5)}</text>)}
      </svg>
    </div>
  );
}

function wallPersistence(points: OptionHistoryPoint[], key: "callWall" | "putWall") {
  const current = points.at(-1)?.[key];
  if (current === null || current === undefined) return 0;
  let count = 0;
  for (const point of [...points].reverse()) {
    if (point[key] !== current) break;
    count += 1;
  }
  return count;
}

function movementLabel(current: number | null | undefined, previous: number | null | undefined) {
  if (current === null || current === undefined) return "暂无";
  if (previous === null || previous === undefined) return money(current);
  const delta = current - previous;
  if (Math.abs(delta) < 0.005) return "未变";
  return `${delta > 0 ? "上移" : "下移"} ${money(Math.abs(delta))}`;
}

function persistenceLabel(count: number) {
  if (count === 0) return "暂无墙位记录";
  if (count === 1) return "只有1份记录";
  return `连续 ${count} 份记录`;
}

function WallMigrationChart({ points }: { points: OptionHistoryPoint[] }) {
  const width = 720;
  const height = 230;
  const padding = { left: 32, right: 32, top: 20, bottom: 30 };
  const values = points.flatMap((point) => [point.close, point.callWall, point.putWall]).filter((value): value is number => value !== null && Number.isFinite(value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, Math.abs(max) * 0.04, 1);
  const x = (index: number) => padding.left + (points.length <= 1 ? (width - padding.left - padding.right) / 2 : index / (points.length - 1) * (width - padding.left - padding.right));
  const y = (value: number) => padding.top + (max - value) / range * (height - padding.top - padding.bottom);
  const wallSeries = [
    { key: "callWall" as const, strengthKey: "callWallStrength" as const, label: "看涨墙", color: "#4f8cff" },
    { key: "putWall" as const, strengthKey: "putWallStrength" as const, label: "看跌墙", color: "#f0b45c" },
  ];
  return <div className="wall-migration-chart"><div className="research-chart-legend"><span><i style={{ background: "#f3f6fb" }} />收盘价</span>{wallSeries.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.label} · 线宽代表强度</span>)}</div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="最近十份期权记录中的收盘价、看涨墙和看跌墙变化">
    {[0, 0.5, 1].map((ratio) => { const gridY = padding.top + ratio * (height - padding.top - padding.bottom); const value = max - ratio * range; return <g key={ratio}><line x1={padding.left} x2={width - padding.right} y1={gridY} y2={gridY} className="history-grid" /><text x={padding.left} y={gridY - 5}>{money(value)}</text></g>; })}
    {points.slice(1).map((point, index) => <line key={`close-${point.date}`} x1={x(index)} y1={y(points[index].close)} x2={x(index + 1)} y2={y(point.close)} stroke="#f3f6fb" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />)}
    {wallSeries.map((item) => <g key={item.key}>{points.slice(1).map((point, index) => {
      const previous = points[index];
      const start = previous[item.key];
      const end = point[item.key];
      if (start === null || end === null) return null;
      const strength = ((previous[item.strengthKey] ?? 0) + (point[item.strengthKey] ?? 0)) / 2;
      return <line key={`${item.key}-${point.date}`} x1={x(index)} y1={y(start)} x2={x(index + 1)} y2={y(end)} stroke={item.color} strokeWidth={1.5 + strength / 100 * 2.5} vectorEffect="non-scaling-stroke" />;
    })}{points.map((point, index) => {
      const value = point[item.key];
      if (value === null) return null;
      const moved = index > 0 && points[index - 1][item.key] !== value;
      return <circle key={`${item.key}-point-${point.date}`} cx={x(index)} cy={y(value)} r="4" fill={moved ? "#0d1219" : item.color} stroke={item.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />;
    })}</g>)}
    {points.at(-1) && <g className="wall-current-labels"><text x={x(points.length - 1) - 7} y={y(points.at(-1)!.close) - 7} textAnchor="end" style={{ fill: "#f3f6fb" }}>{money(points.at(-1)!.close)}</text>{points.at(-1)!.callWall !== null && <text x={x(points.length - 1) - 7} y={y(points.at(-1)!.callWall!) - 7} textAnchor="end" style={{ fill: "#4f8cff" }}>{money(points.at(-1)!.callWall)}</text>}{points.at(-1)!.putWall !== null && <text x={x(points.length - 1) - 7} y={y(points.at(-1)!.putWall!) + 13} textAnchor="end" style={{ fill: "#f0b45c" }}>{money(points.at(-1)!.putWall)}</text>}</g>}
    {points.map((point, index) => (index === 0 || index === points.length - 1 || index % 2 === 0) && <text key={point.date} x={x(index)} y={height - 8} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}>{point.date.slice(5)}</text>)}
  </svg></div>;
}

function ValidationSample({ sample }: { sample: ExpectedRangeValidation }) {
  return <div className="validation-sample"><span>{sample.forecastDate.slice(5)} → {sample.expiration.slice(5)}</span><b className={sample.closedInside ? "positive" : "warning-text"}>{sample.closedInside ? "到期收盘在区间内" : "到期收盘在区间外"}</b><small>{money(sample.expectedLower)} — {money(sample.expectedUpper)} · 到期收盘 {money(sample.expirationClose)}</small></div>;
}

type History = {
  points: OptionHistoryPoint[];
  validation: {
    sampleSize: number;
    insideCount: number;
    insideRate: number | null;
    upperTouchCount: number;
    lowerTouchCount: number;
    samples: ExpectedRangeValidation[];
    wall: WallContinuationStats;
  };
};

export function OptionStructureHistory({ history }: { history: History }) {
  const usefulPoints = history.points.filter((point) => point.callWall !== null || point.atmIv !== null);
  const migrationPoints = usefulPoints.slice(-10);
  if (!usefulPoints.length) return <div className="chart-empty">期权历史数据还在积累，暂时无法显示变化。</div>;
  const latest = migrationPoints.at(-1);
  const previous = migrationPoints.at(-2);
  const callPersistence = wallPersistence(migrationPoints, "callWall");
  const putPersistence = wallPersistence(migrationPoints, "putWall");
  const wall = history.validation.wall;
  return (
    <div className="option-history-stack">
      <article className="research-chart-card wall-migration-card">
        <div className="research-chart-heading"><div><span>关键价位变化</span><h3>看涨墙和看跌墙最近怎么变</h3></div><b>最近 {migrationPoints.length} 次数据更新</b></div>
        <div className="wall-migration-summary"><div className="call"><span>看涨墙</span><strong>{movementLabel(latest?.callWall, previous?.callWall)}</strong><small>集中强度 {latest?.callWallStrength ?? "—"}/100 · {persistenceLabel(callPersistence)}</small></div><div className="put"><span>看跌墙</span><strong>{movementLabel(latest?.putWall, previous?.putWall)}</strong><small>集中强度 {latest?.putWallStrength ?? "—"}/100 · {persistenceLabel(putPersistence)}</small></div></div>
        <WallMigrationChart points={migrationPoints} />
        <p>蓝线是看涨墙、橙线是看跌墙、白线是收盘价；线越粗表示当次集中强度越高，空心点表示墙位发生变化。</p>
        <small>每个点是一次已保存的数据记录，不一定对应连续交易日；墙位是当次同侧未平仓量最多的行权价。</small>
      </article>
      <article className="research-chart-card">
        <div className="research-chart-heading"><div><span>波动变化</span><h3>期权预估与近20日实际波动</h3></div><b>{usefulPoints.filter((point) => point.atmIv !== null).length} 个期权波动样本</b></div>
        <ResearchLineChart points={usefulPoints} percentValues series={[
          { key: "atmIv", label: "期权预估波动", color: "#b987ff" },
          { key: "rv20", label: "近20日实际波动", color: "#55a7ff", dashed: true },
        ]} />
        <p>紫线来自最近到期期权，蓝线来自此前20个交易日；两者覆盖时间不同，只适合比较高低。</p>
      </article>
      <article className="range-validation-card">
        <div className="research-chart-heading"><div><span>过去到期结果</span><h3>期权估算区间和墙位后来怎样</h3></div><b>{history.validation.sampleSize} 个到期样本</b></div>
        {history.validation.sampleSize === 0 ? <div className="sample-building"><strong>样本积累中</strong><span>最新记录对应的到期日尚未结束，暂不计算历史覆盖。</span></div> : <>
          <div className="validation-metrics reliability-metrics">
            <div><span>到期收盘在区间内</span><strong>{percent(history.validation.insideRate)}</strong><small>{history.validation.insideCount} / {history.validation.sampleSize}</small></div>
            <div><span>期间触及上沿</span><strong>{history.validation.upperTouchCount}</strong><small>{history.validation.upperTouchCount} / {history.validation.sampleSize}</small></div>
            <div><span>期间触及下沿</span><strong>{history.validation.lowerTouchCount}</strong><small>{history.validation.lowerTouchCount} / {history.validation.sampleSize}</small></div>
            <div><span>收盘在看涨墙上方后，次日仍在上方</span><strong>{wall.callSampleSize < 5 ? "积累中" : percent(wall.callHoldRate)}</strong><small>{wall.callHoldCount} / {wall.callSampleSize}</small></div>
            <div><span>收盘在看跌墙下方后，次日仍在下方</span><strong>{wall.putSampleSize < 5 ? "积累中" : percent(wall.putHoldRate)}</strong><small>{wall.putHoldCount} / {wall.putSampleSize}</small></div>
          </div>
          {history.validation.samples.length > 0 && <details className="validation-detail"><summary>查看最近 {history.validation.samples.length} 个区间结果</summary><div className="validation-samples">{history.validation.samples.map((sample) => <ValidationSample key={`${sample.forecastDate}-${sample.expiration}`} sample={sample} />)}</div></details>}
        </>}
        <div className="research-method-note"><b>怎么算</b>区间使用记录当日收盘，以及最近到期、接近现价的 Call 与 Put 价格之和估算；到期前最后一个交易日收盘用来验证结果。墙位统计只看下一交易日是否仍在同一侧。样本可能重叠，不能把历史结果当成未来概率。</div>
      </article>
    </div>
  );
}
