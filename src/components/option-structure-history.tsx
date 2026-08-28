import { money, percent } from "@/lib/format";
import type { OptionHistoryPoint, ExpectedRangeValidation, WallContinuationStats } from "@/lib/indicators/options/option-research";

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
  return <div className="wall-migration-chart"><div className="research-chart-legend"><span><i style={{ background: "#f3f6fb" }} />收盘价</span>{wallSeries.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.label} · 线宽代表强度</span>)}</div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="最近十个期权快照的收盘价、看涨墙和看跌墙迁移">
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
  return <div className="validation-sample"><span>{sample.forecastDate.slice(5)} → {sample.expiration.slice(5)}</span><b className={sample.closedInside ? "positive" : "warning-text"}>{sample.closedInside ? "收盘在区间内" : "收盘越出区间"}</b><small>{money(sample.expectedLower)} — {money(sample.expectedUpper)} · 到期 {money(sample.expirationClose)}</small></div>;
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
  if (!usefulPoints.length) return <div className="chart-empty">期权历史快照正在积累，暂时没有可绘制的结构变化。</div>;
  const latest = migrationPoints.at(-1);
  const previous = migrationPoints.at(-2);
  const callPersistence = wallPersistence(migrationPoints, "callWall");
  const putPersistence = wallPersistence(migrationPoints, "putWall");
  const wall = history.validation.wall;
  return (
    <div className="option-history-stack">
      <article className="research-chart-card wall-migration-card">
        <div className="research-chart-heading"><div><span>墙位迁移</span><h3>墙位方向、强度与持续性</h3></div><b>最近 {migrationPoints.length} 个快照</b></div>
        <div className="wall-migration-summary"><div className="call"><span>看涨墙</span><strong>{movementLabel(latest?.callWall, previous?.callWall)}</strong><small>强度 {latest?.callWallStrength ?? "—"} · 连续 {callPersistence} 快照</small></div><div className="put"><span>看跌墙</span><strong>{movementLabel(latest?.putWall, previous?.putWall)}</strong><small>强度 {latest?.putWallStrength ?? "—"} · 连续 {putPersistence} 快照</small></div></div>
        <WallMigrationChart points={migrationPoints} />
        <p>蓝线为看涨墙、橙线为看跌墙、白线为收盘；墙位改变使用空心点，延续使用实心点，线越粗代表该快照墙位强度越高。</p>
        <small>快照并非连续交易日；墙位来自每个快照内同侧未平仓量最大的行权价。</small>
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
        <div className="research-chart-heading"><div><span>历史复盘</span><h3>区间覆盖与墙位延续</h3></div><b>{history.validation.sampleSize} 个到期样本</b></div>
        {history.validation.sampleSize === 0 ? <div className="sample-building"><strong>样本积累中</strong><span>当前快照对应的到期日尚未结束，暂不计算历史覆盖。</span></div> : <>
          <div className="validation-metrics reliability-metrics">
            <div><span>区间覆盖</span><strong>{percent(history.validation.insideRate)}</strong><small>{history.validation.insideCount} / {history.validation.sampleSize}</small></div>
            <div><span>上沿触及</span><strong>{history.validation.upperTouchCount}</strong><small>{history.validation.upperTouchCount} / {history.validation.sampleSize}</small></div>
            <div><span>下沿触及</span><strong>{history.validation.lowerTouchCount}</strong><small>{history.validation.lowerTouchCount} / {history.validation.sampleSize}</small></div>
            <div><span>站上看涨墙后延续</span><strong>{wall.callSampleSize < 5 ? "积累中" : percent(wall.callHoldRate)}</strong><small>{wall.callHoldCount} / {wall.callSampleSize}</small></div>
            <div><span>跌破看跌墙后延续</span><strong>{wall.putSampleSize < 5 ? "积累中" : percent(wall.putHoldRate)}</strong><small>{wall.putHoldCount} / {wall.putSampleSize}</small></div>
          </div>
          {history.validation.samples.length > 0 && <details className="validation-detail"><summary>查看最近 {history.validation.samples.length} 个区间复盘样本</summary><div className="validation-samples">{history.validation.samples.map((sample) => <ValidationSample key={`${sample.forecastDate}-${sample.expiration}`} sample={sample} />)}</div></details>}
        </>}
        <div className="research-method-note"><b>口径</b>区间以快照当日收盘和最近到期 ATM IV 推算，并用到期日前最后一个交易日收盘验证；墙位延续统计“快照收盘已在墙位外时，下一交易日是否仍在同侧”。样本可能重叠，历史复盘不是未来概率。</div>
      </article>
    </div>
  );
}
