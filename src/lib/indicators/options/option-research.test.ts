import { describe, expect, it } from "vitest";
import { addWallPersistence, calculateIvPercentile, calculateIvTermStructure, calculateOiChange, calculateWallProfile, type OptionHistoryPoint } from "./option-research";
import type { OptionContractRecord } from "@/lib/providers/types";

const row = (tradeDate: string, optionType: "CALL" | "PUT", strike: number, openInterest: number): OptionContractRecord => ({
  symbol: "NVDA", tradeDate, expiration: "2026-09-18", optionType, strike, openInterest,
  contractSymbol: null, contractMultiplier: 100, bid: null, ask: null, last: null, volume: null,
  impliedVolatility: null, delta: null, gamma: null, theta: null, vega: null, provider: "ONCLICKMEDIA",
});

describe("calculateOiChange", () => {
  it("compares only contracts present in both snapshots", () => {
    const result = calculateOiChange(
      [row("2026-08-26", "CALL", 200, 140), row("2026-08-26", "PUT", 200, 80), row("2026-08-26", "CALL", 210, 50)],
      [row("2026-08-25", "CALL", 200, 100), row("2026-08-25", "PUT", 200, 100)],
      205,
    );
    expect(result.matchedContracts).toBe(2);
    expect(result.totalDelta).toBe(20);
    expect(result.points).toEqual([{ strike: 200, callDelta: 40, putDelta: -20 }]);
  });
});

describe("option research profiles", () => {
  it("scores a wall from its concentration and lead over the second strike", () => {
    const profile = calculateWallProfile([
      row("2026-08-26", "CALL", 200, 500),
      row("2026-08-26", "CALL", 210, 100),
      row("2026-08-26", "CALL", 220, 50),
    ], "CALL", 205);
    expect(profile.strike).toBe(200);
    expect(profile.share).toBeCloseTo(500 / 650);
    expect(profile.strength).toBeGreaterThan(80);
  });

  it("builds an ATM IV point for every accessible expiration", () => {
    const first = { ...row("2026-08-26", "CALL", 200, 100), expiration: "2026-09-04", impliedVolatility: 0.5 };
    const second = { ...row("2026-08-26", "PUT", 200, 100), expiration: "2026-09-18", impliedVolatility: 0.6 };
    expect(calculateIvTermStructure([first, second], 201).map((point) => point.atmIv)).toEqual([0.5, 0.6]);
  });

  it("reports IV rank only after enough historical samples exist", () => {
    const history = Array.from({ length: 10 }, (_, index) => ({ atmIv: 0.3 + index * 0.02 })) as OptionHistoryPoint[];
    expect(calculateIvPercentile(history, 0.46).percentile).toBe(90);
    expect(calculateIvPercentile(history.slice(0, 5), 0.46).percentile).toBeNull();
  });

  it("counts only the trailing run of an unchanged wall", () => {
    const profile = calculateWallProfile([row("2026-08-26", "PUT", 190, 500)], "PUT", 205);
    const history = [180, 190, 190].map((strike) => ({ putWall: strike })) as OptionHistoryPoint[];
    expect(addWallPersistence(profile, history, "putWall").persistenceSnapshots).toBe(2);
  });
});
