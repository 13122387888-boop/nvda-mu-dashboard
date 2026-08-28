import { calculateOptionMetrics } from "./option-metrics";
import { atmIv } from "./atm-iv";
import { realizedVolatility } from "../realized-volatility";
import type { OptionContractRecord, StockDailyRecord } from "@/lib/providers/types";

export type WallProfile = {
  strike: number | null;
  openInterest: number;
  totalOpenInterest: number;
  share: number | null;
  dominance: number | null;
  strength: number | null;
  persistenceSnapshots: number;
};

export function calculateWallProfile(chain: OptionContractRecord[], side: "CALL" | "PUT", close: number): WallProfile {
  const totals = new Map<number, number>();
  for (const row of chain) {
    if (row.optionType !== side || !row.openInterest) continue;
    totals.set(row.strike, (totals.get(row.strike) ?? 0) + row.openInterest);
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1] || Math.abs(a[0] - close) - Math.abs(b[0] - close));
  const top = ranked[0];
  if (!top) return { strike: null, openInterest: 0, totalOpenInterest: 0, share: null, dominance: null, strength: null, persistenceSnapshots: 0 };
  const totalOpenInterest = ranked.reduce((sum, item) => sum + item[1], 0);
  const share = totalOpenInterest > 0 ? top[1] / totalOpenInterest : null;
  const dominance = ranked[1]?.[1] ? top[1] / ranked[1][1] : null;
  const concentrationScore = share === null ? 0 : Math.min(100, share * 400);
  const dominanceScore = dominance === null ? concentrationScore : Math.min(100, Math.max(0, (dominance - 1) * 125));
  return {
    strike: top[0],
    openInterest: top[1],
    totalOpenInterest,
    share,
    dominance,
    strength: Math.round(concentrationScore * 0.7 + dominanceScore * 0.3),
    persistenceSnapshots: 1,
  };
}

function contractKey(row: OptionContractRecord) {
  return `${row.expiration}|${row.optionType}|${row.strike}`;
}

export function calculateOiChange(current: OptionContractRecord[], previous: OptionContractRecord[], close: number) {
  if (!previous.length) return { previousDate: null, matchedContracts: 0, totalDelta: null, points: [] as Array<{ strike: number; callDelta: number; putDelta: number }> };
  const previousByContract = new Map(previous.map((row) => [contractKey(row), row]));
  const byStrike = new Map<number, { strike: number; callDelta: number; putDelta: number }>();
  let matchedContracts = 0;
  let totalDelta = 0;
  for (const row of current) {
    const prior = previousByContract.get(contractKey(row));
    if (!prior || row.openInterest === null || prior.openInterest === null) continue;
    matchedContracts += 1;
    const delta = row.openInterest - prior.openInterest;
    totalDelta += delta;
    if (row.strike < close * 0.75 || row.strike > close * 1.25) continue;
    const point = byStrike.get(row.strike) ?? { strike: row.strike, callDelta: 0, putDelta: 0 };
    if (row.optionType === "CALL") point.callDelta += delta;
    else point.putDelta += delta;
    byStrike.set(row.strike, point);
  }
  return {
    previousDate: previous[0]?.tradeDate ?? null,
    matchedContracts,
    totalDelta,
    points: [...byStrike.values()].sort((a, b) => a.strike - b.strike),
  };
}

export type OptionHistoryPoint = {
  date: string;
  close: number;
  callWall: number | null;
  putWall: number | null;
  callWallStrength: number | null;
  putWallStrength: number | null;
  maxPain: number | null;
  atmIv: number | null;
  rv20: number | null;
  expectedUpper: number | null;
  expectedLower: number | null;
  expiration: string | null;
};

export type ExpectedRangeValidation = {
  forecastDate: string;
  expiration: string;
  expectedUpper: number;
  expectedLower: number;
  expirationClose: number;
  closedInside: boolean;
  touchedUpper: boolean;
  touchedLower: boolean;
};

export type WallContinuationStats = {
  callSampleSize: number;
  callHoldCount: number;
  callHoldRate: number | null;
  putSampleSize: number;
  putHoldCount: number;
  putHoldRate: number | null;
};

export function buildOptionResearchHistory(
  snapshots: Array<{ tradeDate: string; records: OptionContractRecord[] }>,
  stocks: StockDailyRecord[],
) {
  const orderedStocks = [...stocks].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  const latestStockDate = orderedStocks.at(-1)?.tradeDate ?? null;
  const points: OptionHistoryPoint[] = [];
  const validations: ExpectedRangeValidation[] = [];

  for (const snapshot of [...snapshots].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))) {
    const stockIndex = orderedStocks.findLastIndex((row) => row.tradeDate <= snapshot.tradeDate);
    if (stockIndex < 0) continue;
    const close = orderedStocks[stockIndex].close;
    const pricing = calculateOptionMetrics(snapshot.records, close);
    const closes = orderedStocks.slice(0, stockIndex + 1).map((row) => row.adjustedClose ?? row.close);
    const callWall = calculateWallProfile(snapshot.records, "CALL", close);
    const putWall = calculateWallProfile(snapshot.records, "PUT", close);
    const point: OptionHistoryPoint = {
      date: snapshot.tradeDate,
      close,
      callWall: callWall.strike,
      putWall: putWall.strike,
      callWallStrength: callWall.strength,
      putWallStrength: putWall.strength,
      maxPain: pricing.maxPain,
      atmIv: pricing.atmIv,
      rv20: realizedVolatility(closes, 20),
      expectedUpper: pricing.expectedUpper,
      expectedLower: pricing.expectedLower,
      expiration: pricing.optionsExpiration,
    };
    points.push(point);

    if (!latestStockDate || !point.expiration || point.expiration > latestStockDate || point.expectedUpper === null || point.expectedLower === null) continue;
    const interval = orderedStocks.filter((row) => row.tradeDate > snapshot.tradeDate && row.tradeDate <= point.expiration!);
    const expirationStock = interval.at(-1);
    if (!expirationStock) continue;
    validations.push({
      forecastDate: snapshot.tradeDate,
      expiration: point.expiration,
      expectedUpper: point.expectedUpper,
      expectedLower: point.expectedLower,
      expirationClose: expirationStock.close,
      closedInside: expirationStock.close >= point.expectedLower && expirationStock.close <= point.expectedUpper,
      touchedUpper: interval.some((row) => row.high >= point.expectedUpper!),
      touchedLower: interval.some((row) => row.low <= point.expectedLower!),
    });
  }

  let callSampleSize = 0;
  let callHoldCount = 0;
  let putSampleSize = 0;
  let putHoldCount = 0;
  for (const point of points) {
    const stockIndex = orderedStocks.findLastIndex((row) => row.tradeDate <= point.date);
    const nextStock = stockIndex >= 0 ? orderedStocks[stockIndex + 1] : null;
    if (!nextStock) continue;
    if (point.callWall !== null && point.close >= point.callWall) {
      callSampleSize += 1;
      if (nextStock.close >= point.callWall) callHoldCount += 1;
    }
    if (point.putWall !== null && point.close <= point.putWall) {
      putSampleSize += 1;
      if (nextStock.close <= point.putWall) putHoldCount += 1;
    }
  }

  return {
    points,
    validation: {
      sampleSize: validations.length,
      insideCount: validations.filter((row) => row.closedInside).length,
      insideRate: validations.length ? validations.filter((row) => row.closedInside).length / validations.length : null,
      upperTouchCount: validations.filter((row) => row.touchedUpper).length,
      lowerTouchCount: validations.filter((row) => row.touchedLower).length,
      samples: validations.slice(-6).reverse(),
      wall: {
        callSampleSize,
        callHoldCount,
        callHoldRate: callSampleSize ? callHoldCount / callSampleSize : null,
        putSampleSize,
        putHoldCount,
        putHoldRate: putSampleSize ? putHoldCount / putSampleSize : null,
      } satisfies WallContinuationStats,
    },
  };
}

export function addWallPersistence(profile: WallProfile, points: OptionHistoryPoint[], key: "callWall" | "putWall") {
  if (profile.strike === null) return profile;
  let persistenceSnapshots = 0;
  for (const point of [...points].reverse()) {
    if (point[key] !== profile.strike) break;
    persistenceSnapshots += 1;
  }
  return { ...profile, persistenceSnapshots: Math.max(persistenceSnapshots, 1) };
}

export function calculateIvTermStructure(chain: OptionContractRecord[], close: number) {
  if (!chain.length) return [];
  const tradeDate = [...chain].sort((a, b) => b.tradeDate.localeCompare(a.tradeDate))[0].tradeDate;
  return [...new Set(chain.map((row) => row.expiration))]
    .filter((expiration) => expiration > tradeDate)
    .sort()
    .map((expiration) => {
      const contracts = chain.filter((row) => row.expiration === expiration);
      return {
        expiration,
        daysToExpiration: Math.ceil((new Date(`${expiration}T00:00:00.000Z`).getTime() - new Date(`${tradeDate}T00:00:00.000Z`).getTime()) / 86_400_000),
        atmIv: atmIv(contracts, close),
        contractCount: contracts.length,
      };
    })
    .filter((point): point is { expiration: string; daysToExpiration: number; atmIv: number; contractCount: number } => point.atmIv !== null);
}

export function calculateIvPercentile(points: OptionHistoryPoint[], currentIv: number | null, minimumSamples = 8) {
  const samples = points.map((point) => point.atmIv).filter((value): value is number => value !== null && Number.isFinite(value)).slice(-60);
  if (currentIv === null || samples.length < minimumSamples) return { percentile: null, sampleSize: samples.length, label: "样本积累中" };
  const percentile = Math.round(samples.filter((value) => value <= currentIv).length / samples.length * 100);
  return { percentile, sampleSize: samples.length, label: percentile >= 70 ? "历史偏高" : percentile <= 30 ? "历史偏低" : "历史中位" };
}
