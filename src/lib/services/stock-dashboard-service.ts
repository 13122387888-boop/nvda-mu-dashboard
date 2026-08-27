import { addDays, dateToYmd, parseYmd } from "@/lib/dates";
import { getPrisma } from "@/lib/db/prisma";
import { calculateGammaExposureProxy } from "@/lib/indicators/options/gamma-exposure";
import { calculateOptionMetrics } from "@/lib/indicators/options/option-metrics";
import { movingAverageSeries } from "@/lib/indicators/moving-average";
import { realizedVolatility } from "@/lib/indicators/realized-volatility";
import { wilderRsi } from "@/lib/indicators/rsi";
import type { OptionContractRecord, SupportedSymbol } from "@/lib/providers/types";

export const STOCKS: Record<SupportedSymbol, { name: string; accent: string }> = {
  NVDA: { name: "英伟达 NVIDIA", accent: "#76b900" },
  MU: { name: "美光科技 Micron", accent: "#4f8cff" },
};

export const SUPPORTED_SYMBOLS = Object.keys(STOCKS) as SupportedSymbol[];

export function isSupportedSymbol(value: string): value is SupportedSymbol {
  return value === "NVDA" || value === "MU";
}

const numberOrNull = (value: { toString(): string } | null) => value === null ? null : Number(value);

type OptionDatabaseRow = {
  symbol: string;
  tradeDate: Date;
  expiration: Date;
  optionType: "CALL" | "PUT";
  strike: { toString(): string };
  contractSymbol: string | null;
  contractMultiplier: number;
  bid: { toString(): string } | null;
  ask: { toString(): string } | null;
  last: { toString(): string } | null;
  volume: bigint | null;
  openInterest: bigint | null;
  impliedVolatility: { toString(): string } | null;
  delta: { toString(): string } | null;
  gamma: { toString(): string } | null;
  theta: { toString(): string } | null;
  vega: { toString(): string } | null;
};

function toOptionRecord(row: OptionDatabaseRow): OptionContractRecord {
  return {
    symbol: row.symbol as SupportedSymbol,
    tradeDate: dateToYmd(row.tradeDate),
    expiration: dateToYmd(row.expiration),
    optionType: row.optionType,
    strike: Number(row.strike),
    contractSymbol: row.contractSymbol,
    contractMultiplier: row.contractMultiplier,
    bid: numberOrNull(row.bid),
    ask: numberOrNull(row.ask),
    last: numberOrNull(row.last),
    volume: row.volume === null ? null : Number(row.volume),
    openInterest: row.openInterest === null ? null : Number(row.openInterest),
    impliedVolatility: numberOrNull(row.impliedVolatility),
    delta: numberOrNull(row.delta),
    gamma: numberOrNull(row.gamma),
    theta: numberOrNull(row.theta),
    vega: numberOrNull(row.vega),
    provider: "ONCLICKMEDIA",
  };
}

function percentileRank(values: Array<number | null>, current: number | null, minimumSamples = 60) {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value)).slice(-252);
  if (current === null || !Number.isFinite(current) || valid.length < minimumSamples) {
    return { percentile: null, sampleSize: valid.length };
  }
  const atOrBelow = valid.filter((value) => value <= current).length;
  return { percentile: Math.round((atOrBelow / valid.length) * 100), sampleSize: valid.length };
}

function buildHistoricalPositions(closes: number[], current: { rsi14: number | null; rv20: number | null; ma20: number | null }) {
  const rsiSeries = closes.map((_, index) => wilderRsi(closes.slice(0, index + 1), 14));
  const rvSeries = closes.map((_, index) => realizedVolatility(closes.slice(0, index + 1), 20));
  const ma20Series = movingAverageSeries(closes, 20);
  const deviationSeries = closes.map((close, index) => ma20Series[index] === null ? null : (close / ma20Series[index]! - 1));
  const currentDeviation = current.ma20 === null || current.ma20 === 0 ? null : closes.at(-1)! / current.ma20 - 1;
  return {
    rsi14: { value: current.rsi14, ...percentileRank(rsiSeries, current.rsi14) },
    rv20: { value: current.rv20, ...percentileRank(rvSeries, current.rv20) },
    ma20Deviation: { value: currentDeviation, ...percentileRank(deviationSeries, currentDeviation) },
  };
}

export async function getStockCards() {
  const prisma = getPrisma();
  return Promise.all(SUPPORTED_SYMBOLS.map(async (symbol) => {
    const metrics = await prisma.stockMetrics.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" } });
    return {
      symbol,
      name: STOCKS[symbol].name,
      accent: STOCKS[symbol].accent,
      close: metrics ? Number(metrics.close) : null,
      dailyChangePct: metrics ? numberOrNull(metrics.dailyChangePct) : null,
      marketStatus: metrics?.marketStatus ?? "INSUFFICIENT_DATA",
      dataDate: metrics ? dateToYmd(metrics.tradeDate) : null,
    };
  }));
}

export async function getStockDashboard(symbol: SupportedSymbol, requestedExpiration?: string | null) {
  const prisma = getPrisma();
  const metrics = await prisma.stockMetrics.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" } });
  if (!metrics) return null;

  const chartStartDate = addDays(dateToYmd(metrics.tradeDate), -190);
  const calculationStartDate = addDays(dateToYmd(metrics.tradeDate), -450);
  const calculationHistory = await prisma.stockDaily.findMany({
    where: { symbol, tradeDate: { gte: new Date(`${calculationStartDate}T00:00:00.000Z`) } },
    orderBy: { tradeDate: "asc" },
  });
  const closes = calculationHistory.map((row) => Number(row.adjustedClose ?? row.close));
  const ma20 = movingAverageSeries(closes, 20);
  const ma50 = movingAverageSeries(closes, 50);
  const ma200 = movingAverageSeries(closes, 200);
  const close = Number(metrics.close);
  const expirationRows = metrics.optionsTradeDate
    ? await prisma.optionEod.findMany({
        where: { symbol, tradeDate: metrics.optionsTradeDate, expiration: { gt: metrics.optionsTradeDate } },
        select: { expiration: true },
        distinct: ["expiration"],
        orderBy: { expiration: "asc" },
      })
    : [];
  const availableExpirations = expirationRows.map((row) => dateToYmd(row.expiration));
  const savedExpiration = metrics.optionsExpiration ? dateToYmd(metrics.optionsExpiration) : null;
  const selectedExpiration = requestedExpiration && availableExpirations.includes(requestedExpiration)
    ? requestedExpiration
    : savedExpiration && availableExpirations.includes(savedExpiration)
      ? savedExpiration
      : availableExpirations[0] ?? null;
  const optionRows = metrics.optionsTradeDate && selectedExpiration
    ? await prisma.optionEod.findMany({
        where: { symbol, tradeDate: metrics.optionsTradeDate, expiration: parseYmd(selectedExpiration) },
        orderBy: { strike: "asc" },
      })
    : [];
  const optionRecords = optionRows.map(toOptionRecord);
  const selectedOptionMetrics = calculateOptionMetrics(optionRecords, close);
  const gammaExposure = calculateGammaExposureProxy(optionRows.map((row) => ({
    optionType: row.optionType,
    gamma: numberOrNull(row.gamma),
    openInterest: row.openInterest === null ? null : Number(row.openInterest),
    contractMultiplier: row.contractMultiplier,
  })), close);
  const oi = new Map<number, { strike: number; callOi: number; putOi: number }>();
  for (const row of optionRows) {
    const strike = Number(row.strike);
    if (strike < close * 0.75 || strike > close * 1.25) continue;
    const point = oi.get(strike) ?? { strike, callOi: 0, putOi: 0 };
    const value = row.openInterest === null ? 0 : Number(row.openInterest);
    if (row.optionType === "CALL") point.callOi += value;
    else point.putOi += value;
    oi.set(strike, point);
  }

  const previousCloses = closes.slice(0, -1);
  const previousStockDate = calculationHistory.at(-2)?.tradeDate ?? null;
  const previousRsi14 = wilderRsi(previousCloses, 14);
  const previousRv20 = realizedVolatility(previousCloses, 20);
  const previousOptionDateRow = metrics.optionsTradeDate && selectedExpiration
    ? await prisma.optionEod.findFirst({
        where: { symbol, expiration: parseYmd(selectedExpiration), tradeDate: { lt: metrics.optionsTradeDate } },
        orderBy: { tradeDate: "desc" },
        select: { tradeDate: true },
      })
    : null;
  const previousOptionRows = previousOptionDateRow && selectedExpiration
    ? await prisma.optionEod.findMany({
        where: { symbol, tradeDate: previousOptionDateRow.tradeDate, expiration: parseYmd(selectedExpiration) },
        orderBy: { strike: "asc" },
      })
    : [];
  const previousOptionCloseRow = previousOptionDateRow
    ? await prisma.stockDaily.findFirst({
        where: { symbol, tradeDate: { lte: previousOptionDateRow.tradeDate } },
        orderBy: { tradeDate: "desc" },
        select: { close: true, adjustedClose: true },
      })
    : null;
  const previousOptionClose = previousOptionCloseRow ? Number(previousOptionCloseRow.adjustedClose ?? previousOptionCloseRow.close) : null;
  const previousOptionMetrics = previousOptionClose === null ? null : calculateOptionMetrics(previousOptionRows.map(toOptionRecord), previousOptionClose);
  const previousGamma = previousOptionClose === null
    ? null
    : calculateGammaExposureProxy(previousOptionRows.map((row) => ({
        optionType: row.optionType,
        gamma: numberOrNull(row.gamma),
        openInterest: row.openInterest === null ? null : Number(row.openInterest),
        contractMultiplier: row.contractMultiplier,
      })), previousOptionClose);
  const currentRsi14 = numberOrNull(metrics.rsi14);
  const currentRv20 = numberOrNull(metrics.rv20);
  const currentMa20 = numberOrNull(metrics.ma20);
  const historicalPositions = buildHistoricalPositions(closes, { rsi14: currentRsi14, rv20: currentRv20, ma20: currentMa20 });

  return {
    symbol,
    name: STOCKS[symbol].name,
    accent: STOCKS[symbol].accent,
    stockDate: dateToYmd(metrics.tradeDate),
    optionsDate: optionRows.length && metrics.optionsTradeDate ? dateToYmd(metrics.optionsTradeDate) : null,
    optionsExpiration: selectedExpiration,
    availableExpirations,
    quote: {
      close,
      dailyChange: numberOrNull(metrics.dailyChange),
      dailyChangePct: numberOrNull(metrics.dailyChangePct),
      marketStatus: metrics.marketStatus,
    },
    trend: {
      ma20: currentMa20,
      ma50: numberOrNull(metrics.ma50),
      ma200: numberOrNull(metrics.ma200),
      rsi14: currentRsi14,
      rv20: currentRv20,
    },
    options: {
      expectedMove: selectedOptionMetrics.expectedMove,
      expectedMovePct: selectedOptionMetrics.expectedMovePct,
      expectedUpper: selectedOptionMetrics.expectedUpper,
      expectedLower: selectedOptionMetrics.expectedLower,
      putCallOi: selectedOptionMetrics.putCallOi,
      maxPain: selectedOptionMetrics.maxPain,
      callWall: selectedOptionMetrics.callWall,
      putWall: selectedOptionMetrics.putWall,
      atmIv: selectedOptionMetrics.atmIv,
      gammaExposure,
    },
    dailyChanges: {
      previousStockDate: previousStockDate ? dateToYmd(previousStockDate) : null,
      previousOptionDate: previousOptionDateRow ? dateToYmd(previousOptionDateRow.tradeDate) : null,
      closePct: numberOrNull(metrics.dailyChangePct),
      rsiDelta: currentRsi14 === null || previousRsi14 === null ? null : currentRsi14 - previousRsi14,
      rv20Delta: currentRv20 === null || previousRv20 === null ? null : currentRv20 - previousRv20,
      callWallMove: selectedOptionMetrics.callWall === null || previousOptionMetrics?.callWall == null ? null : selectedOptionMetrics.callWall - previousOptionMetrics.callWall,
      putWallMove: selectedOptionMetrics.putWall === null || previousOptionMetrics?.putWall == null ? null : selectedOptionMetrics.putWall - previousOptionMetrics.putWall,
      expectedMovePctDelta: selectedOptionMetrics.expectedMovePct === null || previousOptionMetrics?.expectedMovePct == null ? null : selectedOptionMetrics.expectedMovePct - previousOptionMetrics.expectedMovePct,
      gammaFrom: previousGamma?.regime ?? null,
      gammaTo: gammaExposure.regime,
    },
    historicalPositions,
    priceHistory: calculationHistory.map((row, index) => ({
      date: dateToYmd(row.tradeDate),
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      ma20: ma20[index],
      ma50: ma50[index],
      ma200: ma200[index],
    })).filter((point) => point.date >= chartStartDate),
    optionOpenInterest: [...oi.values()],
  };
}

export async function getDebugSnapshot() {
  const prisma = getPrisma();
  return Promise.all(SUPPORTED_SYMBOLS.map(async (symbol) => {
    const [stockCount, optionCount, latestStock, latestOption, latestMetrics, lastSync] = await Promise.all([
      prisma.stockDaily.count({ where: { symbol } }),
      prisma.optionEod.count({ where: { symbol } }),
      prisma.stockDaily.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" }, select: { tradeDate: true } }),
      prisma.optionEod.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" }, select: { tradeDate: true } }),
      prisma.stockMetrics.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" }, select: { tradeDate: true } }),
      prisma.syncRun.findFirst({ where: { symbols: { has: symbol } }, orderBy: { startedAt: "desc" } }),
    ]);
    return {
      symbol,
      latestStockDate: latestStock ? dateToYmd(latestStock.tradeDate) : null,
      stockRowCount: stockCount,
      latestOptionDate: latestOption ? dateToYmd(latestOption.tradeDate) : null,
      optionContractCount: optionCount,
      latestMetricsDate: latestMetrics ? dateToYmd(latestMetrics.tradeDate) : null,
      lastSyncStatus: lastSync?.status ?? null,
      lastSyncTime: lastSync?.completedAt?.toISOString() ?? lastSync?.startedAt.toISOString() ?? null,
    };
  }));
}
