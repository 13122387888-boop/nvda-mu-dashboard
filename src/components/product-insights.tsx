import Link from "next/link";
import { number, percent } from "@/lib/format";

type Position = { value: number | null; percentile: number | null; sampleSize: number };

function positionCopy(percentileValue: number | null, sampleSize: number) {
  if (percentileValue === null) return sampleSize ? `当前仅有 ${sampleSize} 个可比样本` : "暂无可比历史";
  if (percentileValue >= 80) return "处于过去一年偏高区域";
  if (percentileValue <= 20) return "处于过去一年偏低区域";
  return "处于过去一年中间区域";
}

export function HistoricalPosition({ positions }: { positions: { rsi14: Position; rv20: Position; ma20Deviation: Position } }) {
  const items = [
    { label: "RSI 14", display: number(positions.rsi14.value, 1), data: positions.rsi14 },
    { label: "RV20", display: percent(positions.rv20.value), data: positions.rv20 },
    { label: "相对20日均线", display: percent(positions.ma20Deviation.value), data: positions.ma20Deviation },
  ];
  return (
    <section className="historical-position" aria-labelledby="historical-position-title">
      <div className="historical-heading"><div><span>ONE-YEAR CONTEXT</span><h3 id="historical-position-title">当前读数的历史位置</h3></div><p>高低只表示历史排序，不表示好坏。</p></div>
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

export type OptionWindowValue = "ALL" | "7" | "30" | "50";

const optionWindows: Array<{ value: OptionWindowValue; label: string }> = [
  { value: "ALL", label: "全部" },
  { value: "7", label: "7天" },
  { value: "30", label: "30天" },
  { value: "50", label: "50天" },
];

export function OptionWindowSelector({ symbol, selected }: { symbol: string; selected: OptionWindowValue }) {
  return (
    <div className="expiration-selector" aria-label="选择期权剩余到期天数">
      <div><span>期权到期日</span><small>墙位、未平仓量与 Gamma 按所选范围汇总</small></div>
      <nav>
        {optionWindows.map((item) => (
          <Link href={item.value === "ALL" ? `/stocks/${symbol}` : `/stocks/${symbol}?window=${item.value}`} className={item.value === selected ? "active" : ""} aria-current={item.value === selected ? "page" : undefined} key={item.value}>
            {item.label}
          </Link>
        ))}
      </nav>
      <small>7 / 30 / 50 天均指“剩余到期天数以内”；预期区间、ATM IV 与最大痛点采用范围内最近到期日。</small>
    </div>
  );
}

export function SnapshotLink({ symbol, window }: { symbol: string; window: OptionWindowValue }) {
  const query = window === "ALL" ? "" : `?window=${window}`;
  return <Link className="snapshot-link" href={`/stocks/${symbol}/snapshot${query}`}>微信 / 图片分享 ↗</Link>;
}
