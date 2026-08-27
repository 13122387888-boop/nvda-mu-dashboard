import { addDays, dateToYmd } from "@/lib/dates";
import { getPrisma } from "@/lib/db/prisma";
import { calculateGammaExposureProxy } from "@/lib/indicators/options/gamma-exposure";
import { calculateOptionMetrics } from "@/lib/indicators/options/option-metrics";
import { putCallOpenInterest } from "@/lib/indicators/options/put-call-ratio";
import { movingAverageSeries } from "@/lib/indicators/moving-average";
import { realizedVolatility } from "@/lib/indicators/realized-volatility";
import { wilderRsi } from "@/lib/indicators/rsi";
import type { OptionContractRecord, SupportedSymbol } from "@/lib/providers/types";

export const STOCKS: Record<SupportedSymbol, { name: string; accent: string }> = {
  NVDA: { name: "英伟达 NVIDIA", accent: "#76b900" },
  MU: { name: "美光科技 Micron", accent: "#4f8cff" },
};

export const SUPPORTED_SYMBOLS = Object.keys(STOCKS) as SupportedSymbol[];

export type OptionWindow = "ALL" | "7" | "30" | "50";

const OPTION_WINDOW_LIMITS: Record<OptionWindow, number | null> = {
  ALL: null,
  "7": 7,
  "30": 30,
  "50": 50,
};

const OPTION_WINDOW_LABELS: Record<OptionWindow, string> = {
  ALL: "全部到期日",
  "7": "7天内",
  "30": "30天内",
  "50": "50天内",
};

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

function normalizeOptionWindow(value?: string | null): OptionWindow {
  return value === "7" || value === "30" || value === "50" ? value : "ALL";
}

function remainingDays(tradeDate: Date, expiration: Date) {
  return Math.ceil((expiration.getTime() - tradeDate.getTime()) / 86_400_000);
}

function aggregateOptionWall(chain: OptionContractRecord[], side: "CALL" | "PUT", close: number) {
  const byStrike = new Map<number, number>();
  for (const contract of chain) {
    if (contract.optionType !== side || contract.openInterest === null || contract.openInterest <= 0) continue;
    byStrike.set(contract.strike, (byStrike.get(contract.strike) ?? 0) + contract.openInterest);
  }
  return [...byStrike.entries()]
    .sort((a, b) => b[1] - a[1] || Math.abs(a[0] - close) - Math.abs(b[0] - close))[0]?.[0] ?? null;
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

export async function getStockDashboard(symbol: SupportedSymbol, requestedWindow?: string | null) {
  const prisma = getPrisma();
  const metrics = await prisma.stockMetrics.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" } });
  if (!metrics) return null;

  const chartStartDate = addDays(dateToYmd(metrics.tradeDate), -190);
  const calculationStartDate = addDays(dateToYmd(metrics.tradeDate), -450);
  const [calculationHistory, allOptionRows] = await Promise.all([
    prisma.stockDaily.findMany({
      where: { symbol, tradeDate: { gte: new Date(`${calculationStartDate}T00:00:00.000Z`) } },
      orderBy: { tradeDate: "asc" },
    }),
    metrics.optionsTradeDate
      ? prisma.optionEod.findMany({
          where: { symbol, tradeDate: metrics.optionsTradeDate, expiration: { gt: metrics.optionsTradeDate } },
          orderBy: [{ expiration: "asc" }, { strike: "asc" }],
        })
      : Promise.resolve([]),
  ]);
  const closes = calculationHistory.map((row) => Number(row.adjustedClose ?? row.close));
  const ma20 = movingAverageSeries(closes, 20);
  const ma50 = movingAverageSeries(closes, 50);
  const ma200 = movingAverageSeries(closes, 200);
  const close = Number(metrics.close);
  const optionWindow = normalizeOptionWindow(requestedWindow);
  const optionWindowLimit = OPTION_WINDOW_LIMITS[optionWindow];
  const optionRows = optionWindowLimit === null || !metrics.optionsTradeDate
    ? allOptionRows
    : allOptionRows.filter((row) => remainingDays(metrics.optionsTradeDate!, row.expiration) <= optionWindowLimit);
  const optionRecords = optionRows.map(toOptionRecord);
  const pricingMetrics = calculateOptionMetrics(optionRecords, close);
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
    optionsExpiration: pricingMetrics.optionsExpiration,
    optionWindow,
    optionWindowLabel: OPTION_WINDOW_LABELS[optionWindow],
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
      expectedMove: pricingMetrics.expectedMove,
      expectedMovePct: pricingMetrics.expectedMovePct,
      expectedUpper: pricingMetrics.expectedUpper,
      expectedLower: pricingMetrics.expectedLower,
      putCallOi: putCallOpenInterest(optionRecords),
      maxPain: pricingMetrics.maxPain,
      callWall: aggregateOptionWall(optionRecords, "CALL", close),
      putWall: aggregateOptionWall(optionRecords, "PUT", close),
      atmIv: pricingMetrics.atmIv,
      gammaExposure,
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
