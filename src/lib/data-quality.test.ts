import { describe, expect, it } from "vitest";
import type { OptionContractRecord, StockDailyRecord } from "@/lib/providers/types";
import { assessOptionDataQuality, assessStockDataQuality, optionSnapshotRegression, parseOptionCoverageWarnings } from "./data-quality";

const stockRow = (overrides: Partial<StockDailyRecord> = {}): StockDailyRecord => ({
  symbol: "NVDA",
  tradeDate: "2026-08-28",
  open: 100,
  high: 105,
  low: 99,
  close: 104,
  adjustedClose: 104,
  volume: 1_000,
  provider: "ONCLICKMEDIA",
  ...overrides,
});

const optionRow = (overrides: Partial<OptionContractRecord> = {}): OptionContractRecord => ({
  symbol: "NVDA",
  tradeDate: "2026-08-28",
  expiration: "2026-09-04",
  optionType: "CALL",
  strike: 105,
  contractSymbol: null,
  contractMultiplier: 100,
  bid: 1,
  ask: 1.1,
  last: 1.05,
  volume: 10,
  openInterest: 100,
  impliedVolatility: 0.4,
  delta: 0.5,
  gamma: 0.02,
  theta: -0.1,
  vega: 0.1,
  provider: "ONCLICKMEDIA",
  ...overrides,
});

describe("stock data quality", () => {
  it("accepts internally consistent OHLC data at the provider date", () => {
    expect(assessStockDataQuality([stockRow()], { expectedSymbol: "NVDA", expectedLatestDate: "2026-08-28" }).level).toBe("GOOD");
  });

  it("rejects invalid OHLC data before persistence", () => {
    const result = assessStockDataQuality([stockRow({ high: 98 })], { expectedSymbol: "NVDA" });
    expect(result.level).toBe("FAILED");
    expect(result.reasons[0]).toContain("OHLC");
  });
});

describe("option data quality", () => {
  it("parses the provider's partial-chain warning", () => {
    expect(parseOptionCoverageWarnings(["only 320 strikes out of 2,843 strikes were returned"])).toEqual({
      returned: 320,
      available: 2843,
      ratio: 320 / 2843,
    });
  });

  it("marks an otherwise complete snapshot as limited when upstream truncates the chain", () => {
    const result = assessOptionDataQuality([
      optionRow(),
      optionRow({ optionType: "PUT", strike: 100 }),
    ], { expectedSymbol: "NVDA", warnings: ["only 16 strikes out of 149 strikes were returned"] });
    expect(result.level).toBe("LIMITED");
    expect(result.stats.upstreamCoverage?.ratio).toBeCloseTo(16 / 149);
  });

  it("rejects a snapshot without both option sides", () => {
    const result = assessOptionDataQuality([optionRow()], { expectedSymbol: "NVDA" });
    expect(result.level).toBe("FAILED");
    expect(result.reasons).toContain("Option records do not contain both Call and Put contracts");
  });

  it("rejects invalid market fields and already-expired rows", () => {
    const result = assessOptionDataQuality([
      optionRow({ bid: 2, ask: 1 }),
      optionRow({ optionType: "PUT", strike: 100, expiration: "2026-08-27" }),
    ], { expectedSymbol: "NVDA" });
    expect(result.level).toBe("FAILED");
    expect(result.reasons.join(" ")).toContain("invalid quotes");
    expect(result.reasons.join(" ")).toContain("expired before");
  });

  it("detects a severe same-day option snapshot regression", () => {
    expect(optionSnapshotRegression(
      { recordCount: 640, expirationCount: 20 },
      { recordCount: 120, expirationCount: 5 },
    )).toContain("rows");
    expect(optionSnapshotRegression(
      { recordCount: 640, expirationCount: 20 },
      { recordCount: 600, expirationCount: 19 },
    )).toBeNull();
  });
});
