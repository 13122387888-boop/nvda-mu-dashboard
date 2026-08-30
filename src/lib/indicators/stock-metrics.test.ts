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
  classifyMarketStatus,
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
      volumeConfirmation: { dailyChangePct: null, relativeVolume: null, contribution: 0 },
      rawScore: 50,
      score: 50,
    });

    const strong = calculateTrendScoreBreakdown({
      close: 150,
      ma50: 110,
      ma100: 100,
      ma200: 80,
      rsi14: 80,
      previousClose: 100,
      relativeVolume: 2,
    });
    expect(strong?.pricePosition).toMatchObject({ ma50: 5, ma100: 8, ma200: 12, total: 25 });
    expect(strong?.alignment.total).toBe(10);
    expect(strong?.momentum.contribution).toBe(10);
    expect(strong?.volumeConfirmation.contribution).toBe(5);
    expect(strong?.rawScore).toBe(100);
    expect(strong?.score).toBe(100);
    expect(calculateTrendScore({
      close: 150,
      ma50: 110,
      ma100: 100,
      ma200: 80,
      rsi14: 80,
      previousClose: 100,
      relativeVolume: 2,
    })).toBe(strong?.score);

    expect(calculateTrendScoreBreakdown({ close: 100, ma50: null, ma100: null, ma200: 100, rsi14: null })).toBeNull();
  });

  it("normalizes available moving-average weights while requiring at least two averages", () => {
    const twoAverages = calculateTrendScoreBreakdown({
      close: 200,
      ma50: 100,
      ma100: 100,
      ma200: null,
      rsi14: 50,
    });
    expect(twoAverages?.pricePosition.total).toBe(25);

    const oneComparablePair = calculateTrendScoreBreakdown({
      close: 100,
      ma50: 110,
      ma100: 100,
      ma200: null,
      rsi14: 50,
    });
    expect(oneComparablePair?.alignment).toMatchObject({ ma50VsMa100: 10, ma100VsMa200: 0, total: 10 });

    const noAdjacentPair = calculateTrendScoreBreakdown({
      close: 100,
      ma50: 110,
      ma100: null,
      ma200: 90,
      rsi14: 50,
    });
    expect(noAdjacentPair?.alignment.total).toBe(0);
  });

  it("uses relative volume only as direction-aware price-volume confirmation", () => {
    const base = { close: 110, ma50: 100, ma100: 95, ma200: 90, rsi14: 50 };
    expect(calculateTrendScoreBreakdown({ ...base, previousClose: 100, relativeVolume: 2 })?.volumeConfirmation.contribution).toBe(5);
    expect(calculateTrendScoreBreakdown({ ...base, close: 90, previousClose: 100, relativeVolume: 2 })?.volumeConfirmation.contribution).toBe(-5);
    expect(calculateTrendScoreBreakdown({ ...base, previousClose: 100, relativeVolume: 1.5 })?.volumeConfirmation.contribution).toBe(2.5);
    expect(calculateTrendScoreBreakdown({ ...base, previousClose: 100, relativeVolume: 1 })?.volumeConfirmation.contribution).toBe(0);
    expect(calculateTrendScoreBreakdown({ ...base, close: 100.1, previousClose: 100, relativeVolume: 2 })?.volumeConfirmation.contribution).toBe(0);
  });

  it("keeps the raw V2 score naturally within the 0 to 100 range", () => {
    const weakest = calculateTrendScoreBreakdown({
      close: 50,
      ma50: 100,
      ma100: 110,
      ma200: 120,
      rsi14: 20,
      previousClose: 100,
      relativeVolume: 3,
    });
    expect(weakest?.rawScore).toBe(0);
    expect(weakest?.score).toBe(0);
  });

  it("feeds prior close and RVOL20 into the metrics trend score", () => {
    const history = records(200);
    history[history.length - 1] = { ...history.at(-1)!, volume: 200 };
    const metrics = calculateStockMetrics(history);
    expect(metrics?.relativeVolume).toBe(2);
    expect(metrics?.trendScore).toBe(100);
    expect(calculateTrendScore({
      close: 200,
      ma50: 175.5,
      ma100: 150.5,
      ma200: 100.5,
      rsi14: 100,
      previousClose: 199,
      relativeVolume: 1,
    })).toBe(95);
  });

  it("classifies the market status from the same V2 score", () => {
    expect(classifyMarketStatus({
      close: 150,
      ma50: 110,
      ma100: 100,
      ma200: 80,
      rsi14: 80,
      previousClose: 100,
      relativeVolume: 2,
    })).toBe("STRONG_BULLISH");
    expect(classifyMarketStatus({ close: 100, ma50: 100, ma100: 100, ma200: 100, rsi14: 70 })).toBe("BULLISH");
    expect(classifyMarketStatus({ close: 100, ma50: 100, ma100: 100, ma200: 100, rsi14: 50 })).toBe("NEUTRAL");
    expect(classifyMarketStatus({ close: 98, ma50: 100, ma100: 100, ma200: 100, rsi14: 30 })).toBe("BEARISH");
    expect(classifyMarketStatus({ close: 100, ma50: null, ma100: null, ma200: 100, rsi14: 50 })).toBe("INSUFFICIENT_DATA");
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
