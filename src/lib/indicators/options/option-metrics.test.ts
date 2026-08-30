import { describe, expect, it } from "vitest";
import type { OptionContractRecord, OptionSide } from "@/lib/providers/types";
import { atmIv } from "./atm-iv";
import { contractPrice, expectedMove } from "./expected-move";
import { maxPain } from "./max-pain";
import { calculateOptionMetrics } from "./option-metrics";
import { optionWall } from "./option-walls";
import { putCallOpenInterest } from "./put-call-ratio";

function contract(optionType: OptionSide, strike: number, openInterest: number, extra: Partial<OptionContractRecord> = {}): OptionContractRecord {
  return {
    symbol: "NVDA",
    tradeDate: "2026-08-25",
    expiration: "2026-08-28",
    optionType,
    strike,
    contractSymbol: null,
    contractMultiplier: 100,
    bid: 2,
    ask: 4,
    last: 2,
    volume: 1,
    openInterest,
    impliedVolatility: optionType === "CALL" ? 0.4 : 0.6,
    delta: null,
    gamma: null,
    theta: null,
    vega: null,
    provider: "ONCLICKMEDIA",
    ...extra,
  };
}

const chain = [
  contract("CALL", 90, 10), contract("PUT", 90, 5),
  contract("CALL", 100, 20), contract("PUT", 100, 20, { bid: null, ask: null, last: 2 }),
  contract("CALL", 110, 5), contract("PUT", 110, 10),
];

describe("option indicators", () => {
  it("uses valid bid/ask mid and falls back to last", () => {
    expect(contractPrice(chain[2])).toBe(3);
    expect(contractPrice(chain[3])).toBe(2);
    expect(contractPrice(contract("CALL", 100, 1, { bid: 4, ask: 3, last: 1.5 }))).toBe(1.5);
  });

  it("calculates expected move and bounds", () => {
    expect(expectedMove(chain, 100)).toEqual({
      expectedMove: 5,
      expectedMovePct: 0.05,
      expectedUpper: 105,
      expectedLower: 95,
    });
  });

  it("calculates put/call OI, max pain and walls", () => {
    expect(putCallOpenInterest(chain)).toBe(35 / 35);
    expect(maxPain(chain, 100)).toBe(100);
    expect(optionWall(chain, "CALL", 100)).toBe(100);
    expect(optionWall(chain, "PUT", 100)).toBe(100);
  });

  it("calculates ATM IV", () => {
    expect(atmIv(chain, 101)).toBeCloseTo(0.5);
    expect(atmIv([contract("CALL", 100, 1)], 100)).toBe(0.4);
    expect(atmIv([
      contract("CALL", 100, 1, { impliedVolatility: null }),
      contract("CALL", 110, 1, { impliedVolatility: 0.7 }),
    ], 101)).toBeNull();
  });

  it("uses all future expirations for walls while keeping pricing on the nearest expiration", () => {
    const multiExpiry = [
      ...chain,
      contract("CALL", 120, 100, { expiration: "2026-09-18" }),
      contract("PUT", 80, 100, { expiration: "2026-09-18" }),
    ];
    const result = calculateOptionMetrics(multiExpiry, 100);
    expect(result.optionsExpiration).toBe("2026-08-28");
    expect(result.expectedMove).toBe(5);
    expect(result.callWall).toBe(120);
    expect(result.putWall).toBe(80);
  });

  it("handles missing sides, zero OI and empty chains", () => {
    expect(expectedMove([contract("CALL", 100, 1)], 100).expectedMove).toBeNull();
    expect(putCallOpenInterest([contract("CALL", 100, 0), contract("PUT", 100, 10)])).toBeNull();
    expect(maxPain([], 100)).toBeNull();
    expect(optionWall([], "CALL", 100)).toBeNull();
    expect(atmIv([], 100)).toBeNull();
  });
});
