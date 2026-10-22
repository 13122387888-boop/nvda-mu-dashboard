import { unstable_cache } from "next/cache";
import { dateToYmd } from "@/lib/dates";
import { getPrisma } from "@/lib/db/prisma";
import { STOCKS, SUPPORTED_SYMBOLS, type SupportedSymbol } from "@/lib/stocks";
import type { StockDailyRecord } from "@/lib/providers/types";
import {
  bollingerBandsSeries,
  summarizeBollingerBands,
} from "@/lib/indicators/bollinger-bands";
import { movingAverageSeries } from "@/lib/indicators/moving-average";
import { relativeVolumeSeries } from "@/lib/indicators/relative-volume";
import { wilderRsi } from "@/lib/indicators/rsi";
import {
  calculateStockMetrics,
  calculateTrendConfidence,
  calculateTrendScoreBreakdown,
} from "@/lib/indicators/stock-metrics";
export { STOCKS, SUPPORTED_SYMBOLS, isSupportedSymbol } from "@/lib/stocks";

export function buildStockDashboard(
  symbol: SupportedSymbol,
  history: StockDailyRecord[],
) {
  const records = history
    .filter((row) => row.provider === "LONGBRIDGE")
    .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  const metrics = calculateStockMetrics(records);
  if (!metrics) return null;
  const closes = records.map((row) => row.adjustedClose ?? row.close);
  const ma50 = movingAverageSeries(closes, 50);
  const ma100 = movingAverageSeries(closes, 100);
  const ma200 = movingAverageSeries(closes, 200);
  const bands = bollingerBandsSeries(closes);
  const volume = relativeVolumeSeries(records.map((row) => row.volume));
  const breakdown = calculateTrendScoreBreakdown({
    ...metrics,
    previousClose: closes.at(-2) ?? null,
  });
  const confidence = calculateTrendConfidence({
    ...metrics,
    historyCount: records.length,
  });
  return {
    symbol,
    ...STOCKS[symbol],
    source: "LONGBRIDGE" as const,
    stockDate: metrics.tradeDate,
    quote: {
      close: metrics.close,
      dailyChange: metrics.dailyChange,
      dailyChangePct: metrics.dailyChangePct,
      marketStatus: metrics.marketStatus,
    },
    trend: {
      ...metrics,
      score: metrics.trendScore,
      breakdown,
      confidence,
      bollinger: summarizeBollingerBands(bands),
      historyCount: records.length,
    },
    priceHistory: records
      .map((row, index) => ({
        date: row.tradeDate,
        open: row.open,
        high: row.high,
        low: row.low,
        close: closes[index],
        ma50: ma50[index],
        ma100: ma100[index],
        ma200: ma200[index],
        bollingerUpper: bands[index].upper,
        bollingerMiddle: bands[index].middle,
        bollingerLower: bands[index].lower,
        bollingerPercentB: bands[index].percentB,
        bollingerBandwidth: bands[index].bandwidth,
        rsi14: wilderRsi(closes.slice(0, index + 1)),
        volume: volume[index].volume,
        volumeAverage20: volume[index].averageVolume,
        relativeVolume: volume[index].relativeVolume,
      }))
      .slice(-130),
  };
}

async function loadStockDashboard(symbol: SupportedSymbol) {
  const rows = await getPrisma().stockDaily.findMany({
    where: { symbol, provider: "LONGBRIDGE" },
    orderBy: { tradeDate: "desc" },
    take: 520,
  });
  return buildStockDashboard(
    symbol,
    rows.map((row) => ({
      symbol,
      tradeDate: dateToYmd(row.tradeDate),
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      adjustedClose:
        row.adjustedClose === null ? null : Number(row.adjustedClose),
      volume: row.volume === null ? null : Number(row.volume),
      provider: "LONGBRIDGE" as const,
    })),
  );
}
const cachedDashboard = unstable_cache(
  loadStockDashboard,
  ["longbridge-dashboard-v1"],
  { revalidate: 300, tags: ["stock-dashboard"] },
);
export const getStockDashboard = (symbol: SupportedSymbol) =>
  cachedDashboard(symbol);
export type StockDashboard = NonNullable<
  Awaited<ReturnType<typeof getStockDashboard>>
>;

export async function getStockCards() {
  // One query per symbol, reused by detail pages through the same cache.
  const cards = [];
  for (let index = 0; index < SUPPORTED_SYMBOLS.length; index += 4) {
    const batch = await Promise.all(
      SUPPORTED_SYMBOLS.slice(index, index + 4).map(async (symbol) => {
        const dashboard = await getStockDashboard(symbol);
        return {
          symbol,
          ...STOCKS[symbol],
          close: dashboard?.quote.close ?? null,
          dailyChangePct: dashboard?.quote.dailyChangePct ?? null,
          dataDate: dashboard?.stockDate ?? null,
          trendScore: dashboard?.trend.score ?? null,
          trendBreakdown: dashboard?.trend.breakdown ?? null,
          trendConfidence: dashboard?.trend.confidence ?? {
            level: "LOW" as const,
            label: "低",
            reason: "等待长桥数据",
          },
          relativeVolume: dashboard?.trend.relativeVolume ?? null,
          rsi14: dashboard?.trend.rsi14 ?? null,
          bollinger: dashboard?.trend.bollinger ?? null,
          marketStatus: dashboard?.quote.marketStatus ?? "INSUFFICIENT_DATA",
        };
      }),
    );
    cards.push(...batch);
  }
  return cards;
}
export type StockCard = Awaited<ReturnType<typeof getStockCards>>[number];
