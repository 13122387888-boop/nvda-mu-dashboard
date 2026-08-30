import { money } from "@/lib/format";

type GammaRegime = "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNAVAILABLE";

export type ExpectedRangeState = "ABOVE" | "BELOW" | "NEAR_UPPER" | "NEAR_LOWER" | "INSIDE" | "UNAVAILABLE";

export type DayOverDayChange = {
  previousStockDate: string | null;
  previousOptionsDate: string | null;
  trendScoreDelta: number | null;
  gamma: { previous: GammaRegime; current: GammaRegime };
  callWall: { previous: number | null; current: number | null; delta: number | null };
  expectedRange: {
    lower: number | null;
    upper: number | null;
    state: ExpectedRangeState;
    boundaryDistancePct: number | null;
  };
  relativeVolume?: { averageVolume: number | null; relativeVolume: number | null };
};

const gammaShort = {
  POSITIVE: "正值",
  NEGATIVE: "负值",
  NEUTRAL: "两侧接近",
  UNAVAILABLE: "暂无",
} as const;

function signedNumber(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

const expectedRangePresentation: Record<ExpectedRangeState, { label: string; tone: string }> = {
  ABOVE: { label: "高于上次期权估算上沿", tone: "warning" },
  BELOW: { label: "低于上次期权估算下沿", tone: "warning" },
  NEAR_UPPER: { label: "接近上次期权估算上沿", tone: "warning" },
  NEAR_LOWER: { label: "接近上次期权估算下沿", tone: "warning" },
  INSIDE: { label: "仍在上次期权估算区间内", tone: "neutral" },
  UNAVAILABLE: { label: "上次期权估算区间暂无", tone: "neutral" },
};

export function dayOverDayItems(change: DayOverDayChange | null) {
  if (!change) return [];
  const gammaChanged = change.gamma.previous !== change.gamma.current;
  const expectedRangeState = change.expectedRange?.state ?? "UNAVAILABLE";
  return [
    {
      label: change.trendScoreDelta === null ? "趋势分暂无对比" : `趋势分 ${signedNumber(change.trendScoreDelta)}`,
      tone: change.trendScoreDelta === null || change.trendScoreDelta === 0 ? "neutral" : change.trendScoreDelta > 0 ? "positive" : "negative",
    },
    {
      label: change.gamma.previous === "UNAVAILABLE"
        ? `Gamma估算 ${gammaShort[change.gamma.current]}`
        : gammaChanged
          ? `Gamma估算 ${gammaShort[change.gamma.previous]}→${gammaShort[change.gamma.current]}`
          : `Gamma估算 ${gammaShort[change.gamma.current]}未变`,
      tone: change.gamma.current === "NEGATIVE" ? "gamma-amplify" : change.gamma.current === "POSITIVE" ? "gamma-stable" : "neutral",
    },
    {
      label: change.callWall.delta === null
        ? "看涨墙没有上次数据"
        : change.callWall.delta === 0
          ? "看涨墙未变"
          : `看涨墙${change.callWall.delta > 0 ? "上移" : "下移"} ${money(Math.abs(change.callWall.delta))}`,
      tone: "neutral",
    },
    {
      ...expectedRangePresentation[expectedRangeState],
    },
  ];
}

export function DayOverDayChips({ change, compact = false }: { change: DayOverDayChange | null; compact?: boolean }) {
  const items = dayOverDayItems(change).filter((item) => !compact || !item.label.includes("暂无") && !item.label.includes("未变"));
  if (!items.length) return <span className="day-change-empty">暂无上一交易日可比数据</span>;
  return <>{items.map((item) => <span className={`day-change-chip ${item.tone}`} key={item.label}>{item.label}</span>)}</>;
}

export function DayOverDayStrip({ change, currentStockDate, currentOptionsDate }: { change: DayOverDayChange | null; currentStockDate: string; currentOptionsDate: string | null }) {
  return (
    <section className="day-change-strip" aria-labelledby="day-change-title">
      <div className="day-change-heading">
        <div><span>上一次到这一次</span><h2 id="day-change-title">和上一份数据相比</h2></div>
        <small>
          价格 {change?.previousStockDate ? `${change.previousStockDate} → ${currentStockDate}` : "暂无前一交易日"}
          {currentOptionsDate && <><i>·</i>期权 {change?.previousOptionsDate ? `${change.previousOptionsDate} → ${currentOptionsDate}` : currentOptionsDate}</>}
        </small>
      </div>
      <div className="day-change-chips"><DayOverDayChips change={change} /></div>
    </section>
  );
}
