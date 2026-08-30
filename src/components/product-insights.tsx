import Link from "next/link";
import { number, percent } from "@/lib/format";
import type { OptionWindow } from "@/lib/services/stock-dashboard-service";

type Position = { value: number | null; percentile: number | null; sampleSize: number };

function positionCopy(percentileValue: number | null, sampleSize: number) {
  if (percentileValue === null) return sampleSize ? `目前只有 ${sampleSize} 个可比读数` : "暂无可比历史";
  if (percentileValue >= 80) return "和过去一年相比偏高";
  if (percentileValue <= 20) return "和过去一年相比偏低";
  return "和过去一年相比处在中间区域";
}

export function HistoricalPosition({ positions }: { positions: { rsi14: Position; rv20: Position; ma50Deviation: Position } }) {
  const items = [
    { label: "短线强弱（RSI）", display: number(positions.rsi14.value, 1), data: positions.rsi14 },
    { label: "近20日实际波动", display: percent(positions.rv20.value), data: positions.rv20 },
    { label: "现价距50日线", display: percent(positions.ma50Deviation.value), data: positions.ma50Deviation },
  ];
  return (
    <section className="historical-position" aria-labelledby="historical-position-title">
      <div className="historical-heading"><div><span>和自己过去比较</span><h3 id="historical-position-title">当前读数比过去一年高还是低</h3></div><p>只表示历史位置，不代表好坏。</p></div>
      <div className="historical-grid">
        {items.map((item) => (
          <article key={item.label}>
            <div><span>{item.label}</span><strong>{item.display}</strong></div>
            <div className="percentile-track" aria-label={`${item.label}历史百分位 ${item.data.percentile ?? "样本不足"}`}><i style={{ width: `${item.data.percentile ?? 0}%` }} /></div>
            <b>{item.data.percentile === null ? "样本不足" : `高于或等于约 ${item.data.percentile}% 的已有读数`}</b>
            <p>{positionCopy(item.data.percentile, item.data.sampleSize)} · {item.data.sampleSize} 个样本</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function SnapshotLink({ symbol, window }: { symbol: string; window: OptionWindow }) {
  const query = window === "ALL" ? "" : `?window=${window}`;
  return <Link className="snapshot-link" href={`/stocks/${symbol}/snapshot${query}`}>分享页面 ↗</Link>;
}
