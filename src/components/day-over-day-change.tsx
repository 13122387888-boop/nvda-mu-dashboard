import { money } from "@/lib/format";

type GammaRegime = "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNAVAILABLE";

export type DayOverDayChange = {
  previousStockDate: string | null;
  previousOptionsDate: string | null;
  trendScoreDelta: number | null;
  gamma: { previous: GammaRegime; current: GammaRegime };
  callWall: { previous: number | null; current: number | null; delta: number | null };
  expectedUpperDistancePct: number | null;
};

const gammaShort = {
  POSITIVE: "正",
  NEGATIVE: "负",
  NEUTRAL: "中性",
  UNAVAILABLE: "暂无",
} as const;

function signedNumber(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

export function dayOverDayItems(change: DayOverDayChange | null) {
  if (!change) return [];
  const gammaChanged = change.gamma.previous !== change.gamma.current;
  return [
    {
      label: change.trendScoreDelta === null ? "趋势分暂无对比" : `趋势分 ${signedNumber(change.trendScoreDelta)}`,
      tone: change.trendScoreDelta === null || change.trendScoreDelta === 0 ? "neutral" : change.trendScoreDelta > 0 ? "positive" : "negative",
    },
    {
      label: change.gamma.previous === "UNAVAILABLE"
        ? `Gamma ${gammaShort[change.gamma.current]}`
        : gammaChanged
          ? `Gamma ${gammaShort[change.gamma.previous]}→${gammaShort[change.gamma.current]}`
          : `Gamma ${gammaShort[change.gamma.current]}未变`,
      tone: change.gamma.current === "NEGATIVE" ? "negative" : change.gamma.current === "POSITIVE" ? "positive" : "neutral",
    },
    {
      label: change.callWall.delta === null
        ? "看涨墙暂无对比"
        : change.callWall.delta === 0
          ? "看涨墙未变"
          : `看涨墙${change.callWall.delta > 0 ? "上移" : "下移"} ${money(Math.abs(change.callWall.delta))}`,
      tone: "neutral",
    },
    {
      label: change.expectedUpperDistancePct === null
        ? "预期上沿暂无"
        : change.expectedUpperDistancePct >= 0
          ? `距预期上沿 ${Math.abs(change.expectedUpperDistancePct).toFixed(1)}%`
          : `高于预期上沿 ${Math.abs(change.expectedUpperDistancePct).toFixed(1)}%`,
      tone: change.expectedUpperDistancePct !== null && change.expectedUpperDistancePct < 0 ? "warning" : "neutral",
    },
  ];
}

export function DayOverDayChips({ change }: { change: DayOverDayChange | null }) {
  const items = dayOverDayItems(change);
  if (!items.length) return <span className="day-change-empty">暂无上一交易日可比数据</span>;
  return <>{items.map((item) => <span className={`day-change-chip ${item.tone}`} key={item.label}>{item.label}</span>)}</>;
}

export function DayOverDayStrip({ change, currentStockDate, currentOptionsDate }: { change: DayOverDayChange | null; currentStockDate: string; currentOptionsDate: string | null }) {
  return (
    <section className="day-change-strip" aria-labelledby="day-change-title">
      <div className="day-change-heading">
        <div><span>变化追踪</span><h2 id="day-change-title">较昨日变化</h2></div>
        <small>
          价格 {change?.previousStockDate ? `${change.previousStockDate} → ${currentStockDate}` : "暂无前一交易日"}
          {currentOptionsDate && <><i>·</i>期权 {change?.previousOptionsDate ? `${change.previousOptionsDate} → ${currentOptionsDate}` : currentOptionsDate}</>}
        </small>
      </div>
      <div className="day-change-chips"><DayOverDayChips change={change} /></div>
    </section>
  );
}
