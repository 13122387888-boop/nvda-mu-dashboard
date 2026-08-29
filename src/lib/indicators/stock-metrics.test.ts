import { describe, expect, it } from "vitest";
import type { StockDailyRecord } from "@/lib/providers/types";
import { simpleMovingAverage } from "./moving-average";
import { realizedVolatility } from "./realized-volatility";
import { wilderRsi } from "./rsi";
import {
  calculateStockMetrics,
  calculateTrendConfidence,
  calculateTrendScore,
  calculateTrendScoreBreakdown,
} from "./stock-metrics";

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
  it("calculates MA50, MA100 and MA200 while preserving the legacy MA20 calculation", () => {
    const values = Array.from({ length: 200 }, (_, index) => index + 1);
    expect(simpleMovingAverage(values, 20)).toBe(190.5);
    expect(simpleMovingAverage(values, 50)).toBe(175.5);
    expect(simpleMovingAverage(values, 100)).toBe(150.5);
    expect(simpleMovingAverage(values, 200)).toBe(100.5);
    expect(calculateStockMetrics(records(200))).toMatchObject({ ma20: 190.5, ma50: 175.5, ma100: 150.5, ma200: 100.5 });
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
    expect(metrics?.ma100).toBeNull();
    expect(metrics?.ma200).toBeNull();
    expect(metrics?.marketStatus).toBe("INSUFFICIENT_DATA");
  });

  it("quantifies trend strength on a 0 to 100 scale", () => {
    expect(calculateTrendScore({ close: 120, ma50: 110, ma100: 100, ma200: 80, rsi14: 65 })).toBeGreaterThanOrEqual(90);
    expect(calculateTrendScore({ close: 80, ma50: 90, ma100: 100, ma200: 120, rsi14: 35 })).toBeLessThanOrEqual(10);
    expect(calculateTrendScore({ close: 100, ma50: 100, ma100: 100, ma200: 100, rsi14: 50 })).toBe(50);
    expect(calculateTrendScore({ close: 100, ma50: null, ma100: null, ma200: 100, rsi14: 50 })).toBeNull();
  });

  it("keeps the displayed trend-score explanation consistent with the final score", () => {
    const neutral = calculateTrendScoreBreakdown({ close: 100, ma50: 100, ma100: 100, ma200: 100, rsi14: 50 });
    expect(neutral).toMatchObject({
      base: 50,
      pricePosition: { ma50: 0, ma100: 0, ma200: 0, total: 0 },
      alignment: { ma50VsMa100: 0, ma100VsMa200: 0, total: 0 },
      momentum: { rsi14: 50, contribution: 0 },
      rawScore: 50,
      score: 50,
    });

    const strong = calculateTrendScoreBreakdown({ close: 150, ma50: 100, ma100: 100, ma200: 100, rsi14: 80 });
    expect(strong?.pricePosition.total).toBe(50);
    expect(strong?.momentum.contribution).toBe(5);
    expect(strong?.rawScore).toBe(105);
    expect(strong?.score).toBe(100);
    expect(calculateTrendScore({ close: 150, ma50: 100, ma100: 100, ma200: 100, rsi14: 80 })).toBe(strong?.score);

    expect(calculateTrendScoreBreakdown({ close: 100, ma50: null, ma100: null, ma200: 100, rsi14: null })).toBeNull();
  });

  it("labels trend confidence from the available history", () => {
    expect(calculateTrendConfidence({ ma50: 100, ma100: 99, ma200: 90, historyCount: 252 }).level).toBe("HIGH");
    expect(calculateTrendConfidence({ ma50: 100, ma100: 99, ma200: null, historyCount: 102 })).toEqual({
      level: "MEDIUM",
      label: "中",
      reason: "长期均线样本尚未满200个交易日",
    });
    expect(calculateTrendConfidence({ ma50: 100, ma100: null, ma200: null, historyCount: 50 }).level).toBe("LOW");
  });
});
