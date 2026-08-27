import { addDays, dateToYmd } from "@/lib/dates";
import { getPrisma } from "@/lib/db/prisma";
import { movingAverageSeries } from "@/lib/indicators/moving-average";
import type { SupportedSymbol } from "@/lib/providers/types";

export const STOCKS: Record<SupportedSymbol, { name: string; accent: string }> = {
  NVDA: { name: "英伟达 NVIDIA", accent: "#76b900" },
  MU: { name: "美光科技 Micron", accent: "#4f8cff" },
};

export const SUPPORTED_SYMBOLS = Object.keys(STOCKS) as SupportedSymbol[];

export function isSupportedSymbol(value: string): value is SupportedSymbol {
  return value === "NVDA" || value === "MU";
}

const numberOrNull = (value: { toString(): string } | null) => value === null ? null : Number(value);

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

export async function getStockDashboard(symbol: SupportedSymbol) {
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

  const optionRows = metrics.optionsTradeDate && metrics.optionsExpiration
    ? await prisma.optionEod.findMany({
        where: { symbol, tradeDate: metrics.optionsTradeDate, expiration: metrics.optionsExpiration },
        orderBy: { strike: "asc" },
      })
    : [];
  const close = Number(metrics.close);
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

  return {
    symbol,
    name: STOCKS[symbol].name,
    accent: STOCKS[symbol].accent,
    stockDate: dateToYmd(metrics.tradeDate),
    optionsDate: metrics.optionsTradeDate ? dateToYmd(metrics.optionsTradeDate) : null,
    optionsExpiration: metrics.optionsExpiration ? dateToYmd(metrics.optionsExpiration) : null,
    quote: {
      close,
      dailyChange: numberOrNull(metrics.dailyChange),
      dailyChangePct: numberOrNull(metrics.dailyChangePct),
      marketStatus: metrics.marketStatus,
    },
    trend: {
      ma20: numberOrNull(metrics.ma20),
      ma50: numberOrNull(metrics.ma50),
      ma200: numberOrNull(metrics.ma200),
      rsi14: numberOrNull(metrics.rsi14),
      rv20: numberOrNull(metrics.rv20),
    },
    options: {
      expectedMove: numberOrNull(metrics.expectedMove),
      expectedMovePct: numberOrNull(metrics.expectedMovePct),
      expectedUpper: numberOrNull(metrics.expectedUpper),
      expectedLower: numberOrNull(metrics.expectedLower),
      putCallOi: numberOrNull(metrics.putCallOi),
      maxPain: numberOrNull(metrics.maxPain),
      callWall: numberOrNull(metrics.callWall),
      putWall: numberOrNull(metrics.putWall),
      atmIv: numberOrNull(metrics.atmIv),
    },
    priceHistory: calculationHistory.map((row, index) => ({
      date: dateToYmd(row.tradeDate),
      close: closes[index],
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
