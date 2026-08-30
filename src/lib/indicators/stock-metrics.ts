import type { StockDailyRecord } from "@/lib/providers/types";
import { simpleMovingAverage } from "./moving-average";
import { latestRelativeVolume } from "./relative-volume";
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

export const TREND_SCORE_WEIGHTS = {
  base: 50,
  pricePosition: 25,
  alignment: 10,
  momentum: 10,
  volumeConfirmation: 5,
} as const;

export const TREND_SCORE_VOLUME_THRESHOLDS = {
  dailyMoveDeadZonePct: 0.2,
  baselineRelativeVolume: 1,
  maximumRelativeVolume: 2,
} as const;

export const TREND_SCORE_STATUS_THRESHOLDS = {
  strongBullish: 75,
  bullish: 60,
  neutral: 40,
} as const;

const MOVING_AVERAGE_CONFIG = {
  ma50: { scale: 0.12, weight: 5 },
  ma100: { scale: 0.18, weight: 8 },
  ma200: { scale: 0.25, weight: 12 },
} as const;

export type TrendScoreInput = {
  close: number;
  ma50: number | null;
  ma100: number | null;
  ma200: number | null;
  rsi14: number | null;
  previousClose?: number | null;
  relativeVolume?: number | null;
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
  volumeConfirmation: {
    dailyChangePct: number | null;
    relativeVolume: number | null;
    contribution: number;
  };
  rawScore: number;
  score: number;
};

function calculateVolumeConfirmation(input: Pick<TrendScoreInput, "close" | "previousClose" | "relativeVolume">) {
  const previousClose = input.previousClose;
  const relativeVolume = input.relativeVolume;
  const hasPreviousClose = typeof previousClose === "number" && Number.isFinite(previousClose) && previousClose > 0;
  const normalizedRelativeVolume = typeof relativeVolume === "number" && Number.isFinite(relativeVolume) && relativeVolume >= 0
    ? relativeVolume
    : null;
  const dailyChangePct = hasPreviousClose ? (input.close / previousClose - 1) * 100 : null;

  if (
    dailyChangePct === null
    || Math.abs(dailyChangePct) < TREND_SCORE_VOLUME_THRESHOLDS.dailyMoveDeadZonePct
    || normalizedRelativeVolume === null
    || normalizedRelativeVolume <= TREND_SCORE_VOLUME_THRESHOLDS.baselineRelativeVolume
  ) {
    return { dailyChangePct, relativeVolume: normalizedRelativeVolume, contribution: 0 };
  }

  const volumeStrength = clamp(
    (normalizedRelativeVolume - TREND_SCORE_VOLUME_THRESHOLDS.baselineRelativeVolume)
      / (TREND_SCORE_VOLUME_THRESHOLDS.maximumRelativeVolume - TREND_SCORE_VOLUME_THRESHOLDS.baselineRelativeVolume),
    0,
    1,
  );
  return {
    dailyChangePct,
    relativeVolume: normalizedRelativeVolume,
    contribution: Math.sign(dailyChangePct) * volumeStrength * TREND_SCORE_WEIGHTS.volumeConfirmation,
  };
}

export function calculateTrendScoreBreakdown(input: TrendScoreInput): TrendScoreBreakdown | null {
  const { close, ma50, ma100, ma200, rsi14 } = input;
  const averages = { ma50, ma100, ma200 };
  const isValidAverage = (value: number | null): value is number => value !== null && Number.isFinite(value) && value > 0;
  const availableAverageEntries = Object.entries(averages).filter(
    (entry): entry is [keyof typeof averages, number] => isValidAverage(entry[1]),
  );
  if (!Number.isFinite(close) || close <= 0 || availableAverageEntries.length < 2) return null;

  const availablePositionWeight = availableAverageEntries.reduce(
    (sum, [key]) => sum + MOVING_AVERAGE_CONFIG[key].weight,
    0,
  );
  const positionNormalization = TREND_SCORE_WEIGHTS.pricePosition / availablePositionWeight;
  const deviationContribution = (key: keyof typeof averages) => {
    const average = averages[key];
    if (!isValidAverage(average)) return 0;
    const config = MOVING_AVERAGE_CONFIG[key];
    return clamp((close / average - 1) / config.scale, -1, 1) * config.weight * positionNormalization;
  };
  const pricePosition = {
    ma50: deviationContribution("ma50"),
    ma100: deviationContribution("ma100"),
    ma200: deviationContribution("ma200"),
    total: 0,
  };
  pricePosition.total = pricePosition.ma50 + pricePosition.ma100 + pricePosition.ma200;

  const comparablePairs = [
    { key: "ma50VsMa100" as const, faster: ma50, slower: ma100 },
    { key: "ma100VsMa200" as const, faster: ma100, slower: ma200 },
  ].filter((pair) => isValidAverage(pair.faster) && isValidAverage(pair.slower));
  const alignmentPerPair = comparablePairs.length === 0 ? 0 : TREND_SCORE_WEIGHTS.alignment / comparablePairs.length;
  const alignmentContributions = new Map(
    comparablePairs.map((pair) => [
      pair.key,
      pair.faster === pair.slower ? 0 : pair.faster! > pair.slower! ? alignmentPerPair : -alignmentPerPair,
    ]),
  );
  const alignment = {
    ma50VsMa100: alignmentContributions.get("ma50VsMa100") ?? 0,
    ma100VsMa200: alignmentContributions.get("ma100VsMa200") ?? 0,
    total: 0,
  };
  alignment.total = alignment.ma50VsMa100 + alignment.ma100VsMa200;
  const momentum = {
    rsi14,
    contribution: rsi14 === null || !Number.isFinite(rsi14)
      ? 0
      : clamp((rsi14 - 50) / 20, -1, 1) * TREND_SCORE_WEIGHTS.momentum,
  };
  const volumeConfirmation = calculateVolumeConfirmation(input);
  const rawScore = TREND_SCORE_WEIGHTS.base
    + pricePosition.total
    + alignment.total
    + momentum.contribution
    + volumeConfirmation.contribution;

  return {
    base: TREND_SCORE_WEIGHTS.base,
    pricePosition,
    alignment,
    momentum,
    volumeConfirmation,
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

export function classifyMarketStatus(input: TrendScoreInput): MarketStatusValue {
  const score = calculateTrendScore(input);
  if (score === null) return "INSUFFICIENT_DATA";
  if (score >= TREND_SCORE_STATUS_THRESHOLDS.strongBullish) return "STRONG_BULLISH";
  if (score >= TREND_SCORE_STATUS_THRESHOLDS.bullish) return "BULLISH";
  if (score >= TREND_SCORE_STATUS_THRESHOLDS.neutral) return "NEUTRAL";
  return "BEARISH";
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
  const relativeVolume = latestRelativeVolume(ordered.map((record) => record.volume)).relativeVolume;
  const trendInput = { close, ma50, ma100, ma200, rsi14, previousClose: previous, relativeVolume };

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
    relativeVolume,
    trendScore: calculateTrendScore(trendInput),
    marketStatus: classifyMarketStatus(trendInput),
  };
}
