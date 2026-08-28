import { calculateOptionMetrics } from "./option-metrics";
import { realizedVolatility } from "../realized-volatility";
import type { OptionContractRecord, StockDailyRecord } from "@/lib/providers/types";

function wall(chain: OptionContractRecord[], side: "CALL" | "PUT", close: number) {
  const totals = new Map<number, number>();
  for (const row of chain) {
    if (row.optionType !== side || !row.openInterest) continue;
    totals.set(row.strike, (totals.get(row.strike) ?? 0) + row.openInterest);
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1] || Math.abs(a[0] - close) - Math.abs(b[0] - close))[0]?.[0] ?? null;
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
    const point: OptionHistoryPoint = {
      date: snapshot.tradeDate,
      close,
      callWall: wall(snapshot.records, "CALL", close),
      putWall: wall(snapshot.records, "PUT", close),
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

  return {
    points,
    validation: {
      sampleSize: validations.length,
      insideCount: validations.filter((row) => row.closedInside).length,
      insideRate: validations.length ? validations.filter((row) => row.closedInside).length / validations.length : null,
      upperTouchCount: validations.filter((row) => row.touchedUpper).length,
      lowerTouchCount: validations.filter((row) => row.touchedLower).length,
      samples: validations.slice(-6).reverse(),
    },
  };
}
