import type { StockDailyRecord } from "@/lib/providers/types";
import { simpleMovingAverage } from "./moving-average";
import { realizedVolatility } from "./realized-volatility";
import { wilderRsi } from "./rsi";

export type MarketStatusValue = "STRONG_BULLISH" | "BULLISH" | "NEUTRAL" | "BEARISH" | "INSUFFICIENT_DATA";
export type TrendConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export type TrendConfidence = {
  level: TrendConfidenceLevel;
  label: string;
  reason: string;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export type TrendScoreInput = {
  close: number;
  ma50: number | null;
  ma100: number | null;
  ma200: number | null;
  rsi14: number | null;
};

export type TrendScoreBreakdown = {
  base: number;
  pricePosition: {
    ma50: number;
    ma100: number;
    ma200: number;
    total: number;
  };
  alignment: {
    ma50VsMa100: number;
    ma100VsMa200: number;
    total: number;
  };
  momentum: {
    rsi14: number | null;
    contribution: number;
  };
  rawScore: number;
  score: number;
};

export function calculateTrendScoreBreakdown(input: TrendScoreInput): TrendScoreBreakdown | null {
  const { close, ma50, ma100, ma200, rsi14 } = input;
  const availableAverages = [ma50, ma100, ma200].filter((value): value is number => value !== null && value > 0);
  if (close <= 0 || availableAverages.length < 2) return null;

  const deviationContribution = (average: number | null, scale: number, weight: number) =>
    average === null || average <= 0 ? 0 : clamp((close / average - 1) / scale, -1, 1) * weight;
  const compareAverages = (faster: number | null, slower: number | null) =>
    faster === null || slower === null || faster === slower ? 0 : faster > slower ? 5 : -5;
  const pricePosition = {
    ma50: deviationContribution(ma50, 0.12, 15),
    ma100: deviationContribution(ma100, 0.18, 15),
    ma200: deviationContribution(ma200, 0.25, 20),
    total: 0,
  };
  pricePosition.total = pricePosition.ma50 + pricePosition.ma100 + pricePosition.ma200;
  const alignment = {
    ma50VsMa100: compareAverages(ma50, ma100),
    ma100VsMa200: compareAverages(ma100, ma200),
    total: 0,
  };
  alignment.total = alignment.ma50VsMa100 + alignment.ma100VsMa200;
  const momentum = {
    rsi14,
    contribution: rsi14 === null ? 0 : clamp((rsi14 - 50) / 20, -1, 1) * 5,
  };
  const rawScore = 50 + pricePosition.total + alignment.total + momentum.contribution;

  return {
    base: 50,
    pricePosition,
    alignment,
    momentum,
    rawScore,
    score: Math.round(clamp(rawScore, 0, 100)),
  };
}

export function calculateTrendScore(input: TrendScoreInput) {
  return calculateTrendScoreBreakdown(input)?.score ?? null;
}

export function calculateTrendConfidence(input: {
  ma50: number | null;
  ma100: number | null;
  ma200: number | null;
  historyCount: number;
}): TrendConfidence {
  const { ma50, ma100, ma200, historyCount } = input;
  if (ma50 !== null && ma100 !== null && ma200 !== null && historyCount >= 200) {
    return { level: "HIGH", label: "高", reason: "50/100/200日均线均有足够历史样本" };
  }
  if (ma50 !== null && ma100 !== null && historyCount >= 100) {
    return { level: "MEDIUM", label: "中", reason: ma200 === null ? "长期均线样本尚未满200个交易日" : "可用历史样本仍在积累" };
  }
  return { level: "LOW", label: "低", reason: "有效历史不足100个交易日，趋势分仅供初步观察" };
}

export function classifyMarketStatus(input: {
  close: number;
  ma50: number | null;
  ma100: number | null;
  ma200: number | null;
  rsi14: number | null;
}): MarketStatusValue {
  const { close, ma50, ma100, ma200, rsi14 } = input;
  if ([ma50, ma100, ma200, rsi14].some((value) => value === null)) return "INSUFFICIENT_DATA";
  if (close > ma50! && ma50! > ma100! && ma100! > ma200! && rsi14! >= 55) return "STRONG_BULLISH";
  if (close > ma100! && ma100! > ma200!) return "BULLISH";
  if (close < ma100! && ma100! < ma200!) return "BEARISH";
  return "NEUTRAL";
}

export function calculateStockMetrics(records: StockDailyRecord[]) {
  const ordered = [...records].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  if (!ordered.length) return null;
  const prices = ordered.map((record) => record.adjustedClose ?? record.close);
  const latest = ordered.at(-1)!;
  const previous = prices.at(-2) ?? null;
  const close = prices.at(-1)!;
  // Keep MA20 in the persisted metrics payload for backwards-compatible syncs.
  const ma20 = simpleMovingAverage(prices, 20);
  const ma50 = simpleMovingAverage(prices, 50);
  const ma100 = simpleMovingAverage(prices, 100);
  const ma200 = simpleMovingAverage(prices, 200);
  const rsi14 = wilderRsi(prices, 14);
  const dailyChange = previous === null ? null : close - previous;

  return {
    symbol: latest.symbol,
    tradeDate: latest.tradeDate,
    close,
    dailyChange,
    dailyChangePct: previous && dailyChange !== null ? (dailyChange / previous) * 100 : null,
    ma20,
    ma50,
    ma100,
    ma200,
    rsi14,
    rv20: realizedVolatility(prices, 20),
    trendScore: calculateTrendScore({ close, ma50, ma100, ma200, rsi14 }),
    marketStatus: classifyMarketStatus({ close, ma50, ma100, ma200, rsi14 }),
  };
}
