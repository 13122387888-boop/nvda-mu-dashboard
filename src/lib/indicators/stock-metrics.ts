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

export function calculateTrendScore(input: {
  close: number;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  rsi14: number | null;
}) {
  const { close, ma20, ma50, ma200, rsi14 } = input;
  const availableAverages = [ma20, ma50, ma200].filter((value): value is number => value !== null && value > 0);
  if (close <= 0 || availableAverages.length < 2) return null;

  const deviationContribution = (average: number | null, scale: number, weight: number) =>
    average === null || average <= 0 ? 0 : clamp((close / average - 1) / scale, -1, 1) * weight;
  const compareAverages = (faster: number | null, slower: number | null) =>
    faster === null || slower === null || faster === slower ? 0 : faster > slower ? 5 : -5;
  const alignment = compareAverages(ma20, ma50) + compareAverages(ma50, ma200);
  const momentum = rsi14 === null ? 0 : clamp((rsi14 - 50) / 20, -1, 1) * 5;

  return Math.round(clamp(
    50
      + deviationContribution(ma20, 0.06, 15)
      + deviationContribution(ma50, 0.12, 15)
      + deviationContribution(ma200, 0.25, 20)
      + alignment
      + momentum,
    0,
    100,
  ));
}

export function calculateTrendConfidence(input: {
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  historyCount: number;
}): TrendConfidence {
  const { ma20, ma50, ma200, historyCount } = input;
  if (ma20 !== null && ma50 !== null && ma200 !== null && historyCount >= 200) {
    return { level: "HIGH", label: "高", reason: "长中短期均线均有足够历史样本" };
  }
  if (ma20 !== null && ma50 !== null && historyCount >= 50) {
    return { level: "MEDIUM", label: "中", reason: ma200 === null ? "长期均线样本尚未满200个交易日" : "可用历史样本仍在积累" };
  }
  return { level: "LOW", label: "低", reason: "有效历史不足50个交易日" };
}

export function classifyMarketStatus(input: {
  close: number;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  rsi14: number | null;
}): MarketStatusValue {
  const { close, ma20, ma50, ma200, rsi14 } = input;
  if ([ma20, ma50, ma200, rsi14].some((value) => value === null)) return "INSUFFICIENT_DATA";
  if (close > ma20! && ma20! > ma50! && ma50! > ma200! && rsi14! >= 55) return "STRONG_BULLISH";
  if (close > ma50! && ma50! > ma200!) return "BULLISH";
  if (close < ma50! && ma50! < ma200!) return "BEARISH";
  return "NEUTRAL";
}

export function calculateStockMetrics(records: StockDailyRecord[]) {
  const ordered = [...records].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  if (!ordered.length) return null;
  const prices = ordered.map((record) => record.adjustedClose ?? record.close);
  const latest = ordered.at(-1)!;
  const previous = prices.at(-2) ?? null;
  const close = prices.at(-1)!;
  const ma20 = simpleMovingAverage(prices, 20);
  const ma50 = simpleMovingAverage(prices, 50);
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
    ma200,
    rsi14,
    rv20: realizedVolatility(prices, 20),
    trendScore: calculateTrendScore({ close, ma20, ma50, ma200, rsi14 }),
    marketStatus: classifyMarketStatus({ close, ma20, ma50, ma200, rsi14 }),
  };
}
