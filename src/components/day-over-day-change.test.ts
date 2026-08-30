import { describe, expect, it } from "vitest";
import { dayOverDayItems, type DayOverDayChange } from "./day-over-day-change";

describe("dayOverDayItems", () => {
  const baseChange: DayOverDayChange = {
    previousStockDate: "2026-08-26",
    previousOptionsDate: "2026-08-25",
    trendScoreDelta: 6,
    gamma: { previous: "POSITIVE", current: "NEGATIVE" },
    callWall: { previous: 220, current: 225, delta: 5 },
    expectedRange: { lower: 200, upper: 230, state: "INSIDE", boundaryDistancePct: 2.2 },
  };

  it("summarizes score, gamma transition, wall movement and the previous expected range", () => {
    const change: DayOverDayChange = {
      ...baseChange,
      expectedRange: { lower: 200, upper: 230, state: "ABOVE", boundaryDistancePct: 1.27 },
    };

    expect(dayOverDayItems(change).map((item) => item.label)).toEqual([
      "趋势分 +6",
      "Gamma估算 正值→负值",
      "看涨墙上移 $5.00",
      "高于上次期权估算上沿",
    ]);
  });

  it.each([
    ["BELOW", "低于上次期权估算下沿"],
    ["NEAR_UPPER", "接近上次期权估算上沿"],
    ["NEAR_LOWER", "接近上次期权估算下沿"],
    ["INSIDE", "仍在上次期权估算区间内"],
    ["UNAVAILABLE", "上次期权估算区间暂无"],
  ] as const)("renders %s expected-range state", (state, expectedLabel) => {
    const change: DayOverDayChange = {
      ...baseChange,
      expectedRange: {
        lower: state === "UNAVAILABLE" ? null : 200,
        upper: state === "UNAVAILABLE" ? null : 230,
        state,
        boundaryDistancePct: state === "UNAVAILABLE" ? null : 1,
      },
    };

    expect(dayOverDayItems(change).at(-1)?.label).toBe(expectedLabel);
  });
});
