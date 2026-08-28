import { describe, expect, it } from "vitest";
import { calculateIvSkew } from "./iv-skew";
import type { OptionContractRecord } from "@/lib/providers/types";

function contract(optionType: "CALL" | "PUT", strike: number, iv: number, delta: number): OptionContractRecord {
  return {
    symbol: "NVDA", tradeDate: "2026-08-27", expiration: "2026-09-25", optionType, strike,
    contractSymbol: null, contractMultiplier: 100, bid: 1, ask: 1.1, last: 1.05, volume: 10, openInterest: 100,
    impliedVolatility: iv, delta, gamma: 0.01, theta: -0.01, vega: 0.1, provider: "ONCLICKMEDIA",
  };
}

describe("calculateIvSkew", () => {
  it("calculates 25-delta put minus call skew", () => {
    const chain = [80, 90, 95, 100, 105, 110, 120].flatMap((strike) => [
      contract("CALL", strike, strike === 110 ? 0.3 : 0.28, strike === 110 ? 0.25 : 0.55),
      contract("PUT", strike, strike === 90 ? 0.36 : 0.31, strike === 90 ? -0.25 : -0.55),
    ]);
    const result = calculateIvSkew(chain, 100);
    expect(result.status).toBe("AVAILABLE");
    expect(result.riskReversalVolPoints).toBeCloseTo(6);
    expect(result.label).toBe("下行保护偏贵");
  });

  it("rejects zero-IV and thin chains", () => {
    const chain = [90, 100].flatMap((strike) => [contract("CALL", strike, 0, 0.25), contract("PUT", strike, 0.3, -0.25)]);
    expect(calculateIvSkew(chain, 100).status).toBe("INSUFFICIENT");
  });
});
