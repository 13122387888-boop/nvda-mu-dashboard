import { describe, expect, it } from "vitest";
import { dayOverDayItems, type DayOverDayChange } from "./day-over-day-change";

describe("dayOverDayItems", () => {
  it("summarizes score, gamma transition, wall movement and upper-range distance", () => {
    const change: DayOverDayChange = {
      previousStockDate: "2026-08-26",
      previousOptionsDate: "2026-08-25",
      trendScoreDelta: 6,
      gamma: { previous: "POSITIVE", current: "NEGATIVE" },
      callWall: { previous: 220, current: 225, delta: 5 },
      expectedUpperDistancePct: 1.27,
    };

    expect(dayOverDayItems(change).map((item) => item.label)).toEqual([
      "趋势分 +6",
      "Gamma 正→负",
      "看涨墙上移 $5.00",
      "距预期上沿 1.3%",
    ]);
  });
});
