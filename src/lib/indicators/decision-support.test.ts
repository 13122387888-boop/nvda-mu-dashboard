import { describe, expect, it } from "vitest";
import { buildObservationScenarios, buildResearchBrief } from "./decision-support";

describe("buildResearchBrief", () => {
  it("summarizes trend, momentum, volatility pricing and gamma structure", () => {
    const result = buildResearchBrief({
      marketStatus: "STRONG_BULLISH",
      rsi14: 62,
      rv20: 0.3,
      atmIv: 0.45,
      gammaRegime: "POSITIVE",
    });
    expect(result.items.map((item) => item.state)).toEqual(["强势偏多", "偏强", "隐含波动较高", "正 Gamma 代理"]);
    expect(result.summary).toContain("期权结构为正 Gamma 代理");
  });

  it("does not invent conclusions when data is unavailable", () => {
    const result = buildResearchBrief({
      marketStatus: "INSUFFICIENT_DATA",
      rsi14: null,
      rv20: null,
      atmIv: null,
      gammaRegime: "UNAVAILABLE",
    });
    expect(result.items.every((item) => item.state === "数据不足")).toBe(true);
  });

  it("uses neutral bands for RSI and volatility ratio", () => {
    const result = buildResearchBrief({
      marketStatus: "NEUTRAL",
      rsi14: 50,
      rv20: 0.4,
      atmIv: 0.42,
      gammaRegime: "NEUTRAL",
    });
    expect(result.items[1].state).toBe("中性");
    expect(result.items[2].state).toBe("两者接近");
  });
});

describe("buildObservationScenarios", () => {
  it("describes the current range and both wall conditions", () => {
    const scenarios = buildObservationScenarios({ close: 100, callWall: 110, putWall: 90, marketStatus: "BULLISH", gammaRegime: "POSITIVE" });
    expect(scenarios[0].title).toBe("现价处于两堵墙之间");
    expect(scenarios[1].condition).toContain("$110.00");
    expect(scenarios[2].condition).toContain("$90.00");
  });

  it("flags a close outside the put wall and handles missing walls", () => {
    const below = buildObservationScenarios({ close: 80, callWall: 110, putWall: 90, marketStatus: "BEARISH", gammaRegime: "NEGATIVE" });
    expect(below[0].title).toBe("现价位于看跌墙下方");
    const missing = buildObservationScenarios({ close: 100, callWall: null, putWall: null, marketStatus: "NEUTRAL", gammaRegime: "UNAVAILABLE" });
    expect(missing[1].title).toBe("看涨墙数据不足");
    expect(missing[2].title).toBe("看跌墙数据不足");
  });
});
