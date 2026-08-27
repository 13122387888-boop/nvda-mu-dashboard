import { addDays, dateToYmd } from "@/lib/dates";
import { getPrisma } from "@/lib/db/prisma";
import { unstable_cache } from "next/cache";
import { calculateGammaExposureProxy } from "@/lib/indicators/options/gamma-exposure";
import { calculateOptionMetrics } from "@/lib/indicators/options/option-metrics";
import { putCallOpenInterest } from "@/lib/indicators/options/put-call-ratio";
import { movingAverageSeries } from "@/lib/indicators/moving-average";
import { realizedVolatility } from "@/lib/indicators/realized-volatility";
import { wilderRsi } from "@/lib/indicators/rsi";
import type { OptionContractRecord, SupportedSymbol } from "@/lib/providers/types";
import { STOCKS, SUPPORTED_SYMBOLS } from "@/lib/stocks";

export { isSupportedSymbol, STOCKS, SUPPORTED_SYMBOLS } from "@/lib/stocks";

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

type AttentionTone = "positive" | "negative" | "warning" | "neutral";

function percentDistance(value: number | null, close: number) {
  return value === null || close <= 0 ? null : Math.abs(value / close - 1) * 100;
}

function stockAttention(input: {
  close: number;
  marketStatus: string;
  optionsDate: string | null;
  gammaRegime: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNAVAILABLE";
  expectedUpper: number | null;
  expectedLower: number | null;
  callWall: number | null;
  putWall: number | null;
  atmIv: number | null;
  rv20: number | null;
}): { label: string; detail: string; score: number; tone: AttentionTone } {
  if (!input.optionsDate) return { label: "期权数据待补充", detail: "价格趋势可用，期权结构暂不可判断", score: 95, tone: "warning" };
  if (input.gammaRegime === "NEGATIVE") return { label: "负 Gamma 环境", detail: "短线波动可能更容易被放大", score: 92, tone: "negative" };

  const rangeLevels = [
    { label: "接近预期上沿", value: input.expectedUpper },
    { label: "接近预期下沿", value: input.expectedLower },
  ].map((item) => ({ ...item, distance: percentDistance(item.value, input.close) }))
    .filter((item): item is typeof item & { distance: number } => item.distance !== null)
    .sort((a, b) => a.distance - b.distance);
  if (rangeLevels[0] && rangeLevels[0].distance <= 2.5) {
    return { label: rangeLevels[0].label, detail: `距离约 ${rangeLevels[0].distance.toFixed(1)}%`, score: 84 - rangeLevels[0].distance, tone: "warning" };
  }

  const wallLevels = [
    { label: "接近看涨墙", value: input.callWall },
    { label: "接近看跌墙", value: input.putWall },
  ].map((item) => ({ ...item, distance: percentDistance(item.value, input.close) }))
    .filter((item): item is typeof item & { distance: number } => item.distance !== null)
    .sort((a, b) => a.distance - b.distance);
  if (wallLevels[0] && wallLevels[0].distance <= 3) {
    return { label: wallLevels[0].label, detail: `距离约 ${wallLevels[0].distance.toFixed(1)}%`, score: 76 - wallLevels[0].distance, tone: "warning" };
  }

  if (input.atmIv !== null && input.rv20 !== null && input.rv20 > 0 && input.atmIv / input.rv20 >= 1.35) {
    return { label: "隐含波动明显偏高", detail: "IV 高于近期实际波动", score: 68, tone: "warning" };
  }
  if (input.marketStatus === "STRONG_BULLISH") return { label: "趋势强势偏多", detail: "价格与均线结构保持强势", score: 52, tone: "positive" };
  if (input.marketStatus === "BEARISH") return { label: "趋势偏空", detail: "价格处于偏弱趋势结构", score: 56, tone: "negative" };
  return { label: "结构暂无明显异常", detail: "进入详情查看完整依据", score: 20, tone: "neutral" };
}

async function loadStockCards() {
  const prisma = getPrisma();
  return Promise.all(SUPPORTED_SYMBOLS.map(async (symbol) => {
    const metrics = await prisma.stockMetrics.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" } });
    if (!metrics) {
      return {
        symbol,
        name: STOCKS[symbol].name,
        shortName: STOCKS[symbol].shortName,
        accent: STOCKS[symbol].accent,
        close: null,
        dailyChangePct: null,
        marketStatus: "INSUFFICIENT_DATA" as const,
        gammaRegime: "UNAVAILABLE" as const,
        attention: { label: "等待首次同步", detail: "数据完成后自动生成观察理由", score: 100, tone: "warning" as const },
        dataDate: null,
      };
    }
    const optionRows = metrics.optionsTradeDate
      ? await prisma.optionEod.findMany({
          where: { symbol, tradeDate: metrics.optionsTradeDate, expiration: { gt: metrics.optionsTradeDate } },
          select: { optionType: true, gamma: true, openInterest: true, contractMultiplier: true },
        })
      : [];
    const close = Number(metrics.close);
    const gammaRegime = calculateGammaExposureProxy(optionRows.map((row) => ({
      optionType: row.optionType,
      gamma: numberOrNull(row.gamma),
      openInterest: row.openInterest === null ? null : Number(row.openInterest),
      contractMultiplier: row.contractMultiplier,
    })), close).regime;
    const optionsDate = metrics.optionsTradeDate ? dateToYmd(metrics.optionsTradeDate) : null;
    const attention = stockAttention({
      close,
      marketStatus: metrics.marketStatus,
      optionsDate,
      gammaRegime,
      expectedUpper: numberOrNull(metrics.expectedUpper),
      expectedLower: numberOrNull(metrics.expectedLower),
      callWall: numberOrNull(metrics.callWall),
      putWall: numberOrNull(metrics.putWall),
      atmIv: numberOrNull(metrics.atmIv),
      rv20: numberOrNull(metrics.rv20),
    });
    return {
      symbol,
      name: STOCKS[symbol].name,
      shortName: STOCKS[symbol].shortName,
      accent: STOCKS[symbol].accent,
      close,
      dailyChangePct: numberOrNull(metrics.dailyChangePct),
      marketStatus: metrics.marketStatus,
      gammaRegime,
      attention,
      dataDate: dateToYmd(metrics.tradeDate),
    };
  }));
}

const getCachedStockCards = unstable_cache(loadStockCards, ["stock-cards-v2"], { revalidate: 300, tags: ["stock-dashboard"] });

export async function getStockCards() {
  return getCachedStockCards();
}

async function loadStockDashboardBundle(symbol: SupportedSymbol) {
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
  const currentRsi14 = numberOrNull(metrics.rsi14);
  const currentRv20 = numberOrNull(metrics.rv20);
  const currentMa20 = numberOrNull(metrics.ma20);
  const historicalPositions = buildHistoricalPositions(closes, { rsi14: currentRsi14, rv20: currentRv20, ma20: currentMa20 });
  const optionWindows = Object.keys(OPTION_WINDOW_LIMITS) as OptionWindow[];
  const optionWindowCounts = Object.fromEntries(optionWindows.map((window) => {
    const limit = OPTION_WINDOW_LIMITS[window];
    const count = limit === null || !metrics.optionsTradeDate
      ? allOptionRows.length
      : allOptionRows.filter((row) => remainingDays(metrics.optionsTradeDate!, row.expiration) <= limit).length;
    return [window, count];
  })) as Record<OptionWindow, number>;
  const priceHistory = calculationHistory.map((row, index) => ({
    date: dateToYmd(row.tradeDate),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    ma20: ma20[index],
    ma50: ma50[index],
    ma200: ma200[index],
  })).filter((point) => point.date >= chartStartDate);

  const dashboards = optionWindows.map((optionWindow) => {
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

    const dashboard = {
      symbol,
      name: STOCKS[symbol].name,
      accent: STOCKS[symbol].accent,
      stockDate: dateToYmd(metrics.tradeDate),
      optionsDate: optionRows.length && metrics.optionsTradeDate ? dateToYmd(metrics.optionsTradeDate) : null,
      optionsExpiration: pricingMetrics.optionsExpiration,
      optionWindow,
      optionWindowLabel: OPTION_WINDOW_LABELS[optionWindow],
      optionWindowCounts,
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
      priceHistory,
      optionOpenInterest: [...oi.values()],
    };
    return [optionWindow, dashboard] as const;
  });

  return Object.fromEntries(dashboards) as Record<OptionWindow, (typeof dashboards)[number][1]>;
}

const getCachedStockDashboardBundle = unstable_cache(
  loadStockDashboardBundle,
  ["stock-dashboard-bundle-v2"],
  { revalidate: 300, tags: ["stock-dashboard"] },
);

export async function getStockDashboard(symbol: SupportedSymbol, requestedWindow?: string | null) {
  const optionWindow = normalizeOptionWindow(requestedWindow);
  const bundle = await getCachedStockDashboardBundle(symbol);
  return bundle?.[optionWindow] ?? null;
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
