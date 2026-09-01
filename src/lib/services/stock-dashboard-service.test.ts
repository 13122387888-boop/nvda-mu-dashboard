import { describe, expect, it } from "vitest";
import {
  assessOptionConclusionFreshness,
  classifyMaStructure,
  classifyExpectedRange,
  ivPercentileLabel,
  stockAttention,
} from "./stock-dashboard-service";

describe("classifyMaStructure", () => {
  it.each([
    [{ close: 120, ma50: 110, ma100: 100, ma200: 90 }, "BULLISH"],
    [{ close: 105, ma50: 110, ma100: 100, ma200: 90 }, "BULLISH_PULLBACK"],
    [{ close: 95, ma50: 110, ma100: 100, ma200: 90 }, "MIXED"],
    [{ close: 80, ma50: 90, ma100: 100, ma200: 110 }, "BEARISH"],
    [{ close: 100, ma50: 90, ma100: 110, ma200: 95 }, "MIXED"],
    [{ close: 100, ma50: 90, ma100: 80, ma200: null }, "UNAVAILABLE"],
  ] as const)("classifies the 50/100/200 MA structure as %s", (input, expected) => {
    expect(classifyMaStructure(input)).toBe(expected);
  });
});

describe("classifyExpectedRange", () => {
  it.each([
    [111, "ABOVE"],
    [89, "BELOW"],
    [107, "NEAR_UPPER"],
    [93, "NEAR_LOWER"],
    [100, "INSIDE"],
  ] as const)("classifies a %s close as %s", (close, state) => {
    expect(classifyExpectedRange(90, 110, close).state).toBe(state);
  });

  it("treats the bounds as inside and applies the 15% edge bands", () => {
    expect(classifyExpectedRange(90, 110, 90).state).toBe("NEAR_LOWER");
    expect(classifyExpectedRange(90, 110, 110).state).toBe("NEAR_UPPER");
    expect(classifyExpectedRange(90, 110, 93.01).state).toBe("INSIDE");
    expect(classifyExpectedRange(90, 110, 106.99).state).toBe("INSIDE");
  });

  it("reports distance to the relevant boundary and unavailable inputs", () => {
    expect(classifyExpectedRange(90, 110, 111).boundaryDistancePct).toBeCloseTo(100 / 111, 8);
    expect(classifyExpectedRange(null, 110, 100)).toEqual({
      lower: null,
      upper: 110,
      state: "UNAVAILABLE",
      boundaryDistancePct: null,
    });
  });
});

describe("ivPercentileLabel", () => {
  it.each([
    [{ percentile: 25, sampleSize: 12 }, "近12次·初步偏低"],
    [{ percentile: 50, sampleSize: 19 }, "近19次·初步中位"],
    [{ percentile: 70, sampleSize: 20 }, "近20次·偏高"],
    [{ percentile: 30, sampleSize: 60 }, "近60次·偏低"],
    [{ percentile: null, sampleSize: 0 }, "近0次·样本不足"],
  ] as const)("formats the sample-aware IV label", (input, label) => {
    expect(ivPercentileLabel(input)).toBe(label);
  });
});

describe("assessOptionConclusionFreshness", () => {
  it("allows an aligned snapshot", () => {
    expect(assessOptionConclusionFreshness({
      stockDate: "2026-08-28",
      snapshotDate: "2026-08-28",
      asOfDate: "2026-08-31",
    })).toMatchObject({ status: "CURRENT", isCurrent: true, ageBusinessDays: 0 });
  });

  it("uses the latest option snapshot when it is only one weekday behind", () => {
    expect(assessOptionConclusionFreshness({
      stockDate: "2026-08-31",
      snapshotDate: "2026-08-28",
      asOfDate: "2026-09-01",
    })).toMatchObject({ status: "CURRENT", isCurrent: true, snapshotDate: "2026-08-28", ageBusinessDays: 1 });
  });

  it("requires the snapshot to match both the latest stock row and metrics date", () => {
    expect(assessOptionConclusionFreshness({
      stockDate: "2026-08-28",
      metricsDate: "2026-08-27",
      snapshotDate: "2026-08-27",
      asOfDate: "2026-08-28",
    })).toMatchObject({ status: "HISTORICAL", isCurrent: false });
  });

  it("marks a snapshot more than one weekday behind as historical", () => {
    expect(assessOptionConclusionFreshness({
      stockDate: "2026-08-28",
      snapshotDate: "2026-08-26",
      asOfDate: "2026-08-28",
    })).toMatchObject({ status: "HISTORICAL", isCurrent: false, ageBusinessDays: 2 });
  });

  it("rejects a future-dated snapshot", () => {
    expect(assessOptionConclusionFreshness({
      stockDate: "2026-08-31",
      snapshotDate: "2026-08-31",
      asOfDate: "2026-08-30",
    })).toMatchObject({ status: "HISTORICAL", isCurrent: false });
  });

  it("requires a stored snapshot rather than trusting the metrics date alone", () => {
    expect(assessOptionConclusionFreshness({
      stockDate: "2026-08-28",
      snapshotDate: "2026-08-28",
      hasSnapshot: false,
      asOfDate: "2026-08-28",
    })).toMatchObject({ status: "UNAVAILABLE", isCurrent: false });
  });
});

describe("stockAttention", () => {
  type AttentionInput = Parameters<typeof stockAttention>[0];
  type Change = NonNullable<AttentionInput["dayOverDay"]>;

  const baseChange: Change = {
    previousStockDate: "2026-08-26",
    previousOptionsDate: "2026-08-26",
    trendScoreDelta: 0,
    gamma: { previous: "POSITIVE", current: "POSITIVE" },
    callWall: { previous: 105, current: 105, delta: 0 },
    expectedRange: { lower: 90, upper: 110, state: "INSIDE", boundaryDistancePct: 10 },
    relativeVolume: { volume: 100, averageVolume: 100, relativeVolume: 1 },
  };
  const currentOptionFreshness = {
    status: "CURRENT" as const,
    isCurrent: true,
    stockDate: "2026-08-27",
    metricsDate: "2026-08-27",
    snapshotDate: "2026-08-27",
    ageBusinessDays: 0,
    reason: "期权快照与当前股票数据对齐",
  };

  function attention(change: Change, overrides: Partial<AttentionInput> = {}) {
    return stockAttention({
      close: 100,
      marketStatus: "NEUTRAL",
      optionFreshness: currentOptionFreshness,
      gammaRegime: change.gamma.current,
      callWall: 105,
      putWall: 90,
      dayOverDay: change,
      ...overrides,
    });
  }

  it("uses Gamma switches before every lower-priority reason", () => {
    const result = attention({
      ...baseChange,
      trendScoreDelta: 20,
      gamma: { previous: "POSITIVE", current: "NEGATIVE" },
      callWall: { previous: 100, current: 104, delta: 4 },
      expectedRange: { lower: 90, upper: 99, state: "ABOVE", boundaryDistancePct: 1 },
      relativeVolume: { volume: 200, averageVolume: 100, relativeVolume: 2 },
    });
    expect(result.label).toBe("Gamma 状态切换");
  });

  it.each([
    [{ ...baseChange, trendScoreDelta: -10 }, {}, "趋势分显著下降"],
    [{ ...baseChange, expectedRange: { lower: 101, upper: 110, state: "BELOW" as const, boundaryDistancePct: 1 } }, {}, "下破昨日预期下沿"],
    [{ ...baseChange, callWall: { previous: 100, current: 103, delta: 3 } }, {}, "看涨墙显著上移"],
    [{ ...baseChange, relativeVolume: { volume: 150, averageVolume: 100, relativeVolume: 1.5 } }, {}, "成交量明显放大"],
    [{ ...baseChange, gamma: { previous: "NEGATIVE" as const, current: "NEGATIVE" as const } }, { gammaRegime: "NEGATIVE" as const }, "负 Gamma 环境"],
    [baseChange, { callWall: 102.5 }, "接近看涨墙"],
  ])("selects reasons in the declared priority order", (change, overrides, label) => {
    expect(attention(change as Change, overrides as Partial<AttentionInput>).label).toBe(label);
  });

  it("does not use a current-day expected boundary as a proximity reason", () => {
    const result = attention({
      ...baseChange,
      expectedRange: { lower: 90, upper: 101, state: "NEAR_UPPER", boundaryDistancePct: 1 },
    }, { callWall: 120, putWall: 80 });
    expect(result.label).toBe("结构暂无明显异常");
  });

  it("never promotes stale Gamma, wall or expected-range signals as current attention", () => {
    const result = attention({
      ...baseChange,
      gamma: { previous: "POSITIVE", current: "NEGATIVE" },
      callWall: { previous: 100, current: 104, delta: 4 },
      expectedRange: { lower: 90, upper: 99, state: "ABOVE", boundaryDistancePct: 1 },
    }, {
      optionFreshness: {
        status: "HISTORICAL",
        isCurrent: false,
        stockDate: "2026-08-27",
        metricsDate: "2026-08-27",
        snapshotDate: "2026-08-26",
        ageBusinessDays: null,
        reason: "期权快照 2026-08-26 与股票日期 2026-08-27 不一致",
      },
      gammaRegime: "NEGATIVE",
      callWall: 101,
      putWall: 99,
    });
    expect(result).toMatchObject({ label: "期权快照非当前", tone: "warning" });
  });

  it("shows a one-weekday-lag snapshot without promoting it as current attention", () => {
    const result = attention({
      ...baseChange,
      gamma: { previous: "POSITIVE", current: "NEGATIVE" },
      callWall: { previous: 100, current: 104, delta: 4 },
      expectedRange: { lower: 90, upper: 99, state: "ABOVE", boundaryDistancePct: 1 },
    }, {
      optionFreshness: {
        status: "CURRENT",
        isCurrent: true,
        stockDate: "2026-08-31",
        metricsDate: "2026-08-31",
        snapshotDate: "2026-08-28",
        ageBusinessDays: 1,
        reason: "使用最近可用期权快照",
      },
      gammaRegime: "NEGATIVE",
      callWall: 101,
      putWall: 99,
    });
    expect(result).toMatchObject({ score: 20, tone: "neutral" });
  });
});
