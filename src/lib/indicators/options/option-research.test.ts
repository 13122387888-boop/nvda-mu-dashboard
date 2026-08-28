import { describe, expect, it } from "vitest";
import { calculateOiChange } from "./option-research";
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
