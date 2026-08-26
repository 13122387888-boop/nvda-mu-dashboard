import { describe, expect, it } from "vitest";
import type { StockDailyRecord } from "@/lib/providers/types";
import { simpleMovingAverage } from "./moving-average";
import { realizedVolatility } from "./realized-volatility";
import { wilderRsi } from "./rsi";
import { calculateStockMetrics } from "./stock-metrics";

function records(count: number): StockDailyRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    symbol: "NVDA",
    tradeDate: `2025-${String(Math.floor(index / 28) + 1).padStart(2, "0")}-${String((index % 28) + 1).padStart(2, "0")}`,
    open: index + 1,
    high: index + 1,
    low: index + 1,
    close: index + 1,
    adjustedClose: index + 1,
    volume: 100,
    provider: "ONCLICKMEDIA",
  }));
}

describe("stock indicators", () => {
  it("calculates MA20, MA50 and MA200", () => {
    const values = Array.from({ length: 200 }, (_, index) => index + 1);
    expect(simpleMovingAverage(values, 20)).toBe(190.5);
    expect(simpleMovingAverage(values, 50)).toBe(175.5);
    expect(simpleMovingAverage(values, 200)).toBe(100.5);
  });

  it("calculates Wilder RSI14", () => {
    expect(wilderRsi(Array.from({ length: 20 }, (_, index) => index + 1), 14)).toBe(100);
  });

  it("calculates annualized RV20 using sample standard deviation", () => {
    expect(realizedVolatility(Array.from({ length: 21 }, () => 100), 20)).toBe(0);
  });

  it("returns null when data is insufficient", () => {
    expect(simpleMovingAverage([1, 2], 20)).toBeNull();
    expect(wilderRsi([1, 2], 14)).toBeNull();
    expect(realizedVolatility([1, 2], 20)).toBeNull();
    const metrics = calculateStockMetrics(records(10));
    expect(metrics?.ma20).toBeNull();
    expect(metrics?.ma50).toBeNull();
    expect(metrics?.ma200).toBeNull();
    expect(metrics?.marketStatus).toBe("INSUFFICIENT_DATA");
  });
});
