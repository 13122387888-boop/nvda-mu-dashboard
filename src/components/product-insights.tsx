import Link from "next/link";
import { number, percent } from "@/lib/format";
import type { OptionWindow } from "@/lib/services/stock-dashboard-service";

type Position = { value: number | null; percentile: number | null; sampleSize: number };

function positionCopy(percentileValue: number | null, sampleSize: number) {
  if (percentileValue === null) return sampleSize ? `当前仅有 ${sampleSize} 个可比样本` : "暂无可比历史";
  if (percentileValue >= 80) return "处于过去一年偏高区域";
  if (percentileValue <= 20) return "处于过去一年偏低区域";
  return "处于过去一年中间区域";
}

export function HistoricalPosition({ positions }: { positions: { rsi14: Position; rv20: Position; ma50Deviation: Position } }) {
  const items = [
    { label: "RSI 14", display: number(positions.rsi14.value, 1), data: positions.rsi14 },
    { label: "RV20", display: percent(positions.rv20.value), data: positions.rv20 },
    { label: "相对50日均线", display: percent(positions.ma50Deviation.value), data: positions.ma50Deviation },
  ];
  return (
    <section className="historical-position" aria-labelledby="historical-position-title">
      <div className="historical-heading"><div><span>一年历史对照</span><h3 id="historical-position-title">当前读数的历史位置</h3></div><p>高低只表示历史排序，不表示好坏。</p></div>
      <div className="historical-grid">
        {items.map((item) => (
          <article key={item.label}>
            <div><span>{item.label}</span><strong>{item.display}</strong></div>
            <div className="percentile-track" aria-label={`${item.label}历史百分位 ${item.data.percentile ?? "样本不足"}`}><i style={{ width: `${item.data.percentile ?? 0}%` }} /></div>
            <b>{item.data.percentile === null ? "样本不足" : `第 ${item.data.percentile} 百分位`}</b>
            <p>{positionCopy(item.data.percentile, item.data.sampleSize)} · {item.data.sampleSize} 个样本</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function SnapshotLink({ symbol, window }: { symbol: string; window: OptionWindow }) {
  const query = window === "ALL" ? "" : `?window=${window}`;
  return <Link className="snapshot-link" href={`/stocks/${symbol}/snapshot${query}`}>分享研究 ↗</Link>;
}
