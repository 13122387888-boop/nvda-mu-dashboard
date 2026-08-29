import { describe, expect, it } from "vitest";
import { buildObservationScenarios, buildResearchBrief } from "./decision-support";

describe("buildResearchBrief", () => {
  it("summarizes MA trend, RSI/BOLL state, volume confirmation and options environment", () => {
    const result = buildResearchBrief({
      marketStatus: "STRONG_BULLISH",
      rsi14: 62,
      relativeVolume: 1.8,
      dailyChangePct: 2,
      bollinger: { percentB: 0.82, bandwidthPercentile: 82, state: "WIDE" },
      rv20: 0.3,
      atmIv: 0.45,
      gammaRegime: "POSITIVE",
    });
    expect(result.items.map((item) => item.state)).toEqual(["强势偏多", "偏强·上轨附近", "放量确认", "正Gamma·IV高于实际波动"]);
    expect(result.summary).toContain("放量确认");
  });

  it("does not invent conclusions when data is unavailable", () => {
    const result = buildResearchBrief({
      marketStatus: "INSUFFICIENT_DATA",
      rsi14: null,
      relativeVolume: null,
      dailyChangePct: null,
      bollinger: { percentB: null, bandwidthPercentile: null, state: "UNAVAILABLE" },
      rv20: null,
      atmIv: null,
      gammaRegime: "UNAVAILABLE",
    });
    expect(result.items[0].state).toBe("数据不足");
    expect(result.items[2].state).toBe("数据不足");
    expect(result.items[3].state).toContain("Gamma暂无");
  });

  it("keeps a partial RSI reading neutral when BOLL position is unavailable", () => {
    const result = buildResearchBrief({
      marketStatus: "BULLISH",
      rsi14: 62,
      relativeVolume: 1,
      dailyChangePct: 0.5,
      bollinger: { percentB: null, bandwidthPercentile: null, state: "UNAVAILABLE" },
      rv20: 0.3,
      atmIv: 0.35,
      gammaRegime: "NEUTRAL",
    });
    expect(result.items[1]).toMatchObject({ state: "偏强·BOLL位置暂无", tone: "neutral" });
  });

  it("uses neutral bands for RSI, BOLL and normal volume", () => {
    const result = buildResearchBrief({
      marketStatus: "NEUTRAL",
      rsi14: 50,
      relativeVolume: 1,
      dailyChangePct: 0.2,
      bollinger: { percentB: 0.5, bandwidthPercentile: 50, state: "NORMAL" },
      rv20: 0.4,
      atmIv: 0.42,
      gammaRegime: "NEUTRAL",
    });
    expect(result.items[1].state).toBe("中性·中轨上方");
    expect(result.items[2].state).toBe("成交常态");
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
