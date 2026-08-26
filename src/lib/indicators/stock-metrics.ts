import type { StockDailyRecord } from "@/lib/providers/types";
import { simpleMovingAverage } from "./moving-average";
import { realizedVolatility } from "./realized-volatility";
import { wilderRsi } from "./rsi";

export type MarketStatusValue = "STRONG_BULLISH" | "BULLISH" | "NEUTRAL" | "BEARISH" | "INSUFFICIENT_DATA";

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
    marketStatus: classifyMarketStatus({ close, ma20, ma50, ma200, rsi14 }),
  };
}
