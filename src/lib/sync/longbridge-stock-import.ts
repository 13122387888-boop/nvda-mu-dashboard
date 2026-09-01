import { Prisma } from "@/generated/prisma/client";
import { dateToYmd, parseYmd } from "@/lib/dates";
import { getPrisma } from "@/lib/db/prisma";
import { calculateOptionMetrics } from "@/lib/indicators/options/option-metrics";
import { calculateStockMetrics } from "@/lib/indicators/stock-metrics";
import type { OptionContractRecord, StockDailyRecord } from "@/lib/providers/types";
import type { SupportedSymbol } from "@/lib/stocks";
import type { LongbridgeCandleBatch, LongbridgeCandleSeries } from "@/lib/sync/longbridge-candles";
import { validateStockSyncObservations } from "@/lib/sync/stock-sync-validation";

const UPSERT_BATCH_SIZE = 200;

function chunks<T>(rows: T[], size: number) {
  const output: T[][] = [];
  for (let index = 0; index < rows.length; index += size) output.push(rows.slice(index, index + size));
  return output;
}

async function upsertSeries(series: LongbridgeCandleSeries) {
  const prisma = getPrisma();
  let count = 0;
  for (const batch of chunks(series.candles, UPSERT_BATCH_SIZE)) {
    const values = batch.map((row) => Prisma.sql`(
      ${series.symbol}, ${parseYmd(row.tradeDate)}, ${row.open}, ${row.high}, ${row.low}, ${row.close},
      ${row.close}, ${row.volume}, ${"LONGBRIDGE"}, NOW(), NOW()
    )`);
    count += await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "stock_daily" (
        "symbol", "trade_date", "open", "high", "low", "close", "adjusted_close", "volume", "provider", "created_at", "updated_at"
      ) VALUES ${Prisma.join(values)}
      ON CONFLICT ("symbol", "trade_date") DO UPDATE SET
        "open" = EXCLUDED."open",
        "high" = EXCLUDED."high",
        "low" = EXCLUDED."low",
        "close" = EXCLUDED."close",
        "adjusted_close" = EXCLUDED."adjusted_close",
        "volume" = EXCLUDED."volume",
        "provider" = EXCLUDED."provider",
        "updated_at" = EXCLUDED."updated_at"
    `);
  }
  return count;
}

async function recalculateLatestMetrics(symbol: SupportedSymbol) {
  const prisma = getPrisma();
  const historyRows = await prisma.stockDaily.findMany({ where: { symbol }, orderBy: { tradeDate: "desc" }, take: 260 });
  const history: StockDailyRecord[] = historyRows.reverse().map((row) => ({
    symbol,
    tradeDate: dateToYmd(row.tradeDate),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    adjustedClose: row.adjustedClose === null ? null : Number(row.adjustedClose),
    volume: row.volume === null ? null : Number(row.volume),
    provider: row.provider === "LONGBRIDGE" ? "LONGBRIDGE" : "ONCLICKMEDIA",
  }));
  const stock = calculateStockMetrics(history);
  if (!stock) throw new Error(`No stock history is available for metric calculation: ${symbol}`);

  // Option conclusions are deliberately joined only on the exact stock date.
  // A stale chain must not be displayed as if it described the new close.
  const optionRows = await prisma.optionEod.findMany({ where: { symbol, tradeDate: parseYmd(stock.tradeDate) } });
  const optionRecords: OptionContractRecord[] = optionRows.map((row) => ({
    symbol,
    tradeDate: dateToYmd(row.tradeDate),
    expiration: dateToYmd(row.expiration),
    optionType: row.optionType,
    strike: Number(row.strike),
    contractSymbol: row.contractSymbol,
    contractMultiplier: row.contractMultiplier,
    bid: row.bid === null ? null : Number(row.bid),
    ask: row.ask === null ? null : Number(row.ask),
    last: row.last === null ? null : Number(row.last),
    volume: row.volume === null ? null : Number(row.volume),
    openInterest: row.openInterest === null ? null : Number(row.openInterest),
    impliedVolatility: row.impliedVolatility === null ? null : Number(row.impliedVolatility),
    delta: row.delta === null ? null : Number(row.delta),
    gamma: row.gamma === null ? null : Number(row.gamma),
    theta: row.theta === null ? null : Number(row.theta),
    vega: row.vega === null ? null : Number(row.vega),
    provider: "ONCLICKMEDIA",
  }));
  const options = calculateOptionMetrics(optionRecords, stock.close);
  const metricData = {
    optionsTradeDate: options.optionsTradeDate ? parseYmd(options.optionsTradeDate) : null,
    optionsExpiration: options.optionsExpiration ? parseYmd(options.optionsExpiration) : null,
    close: stock.close,
    dailyChange: stock.dailyChange,
    dailyChangePct: stock.dailyChangePct,
    ma20: stock.ma20,
    ma50: stock.ma50,
    ma200: stock.ma200,
    rsi14: stock.rsi14,
    rv20: stock.rv20,
    expectedMove: options.expectedMove,
    expectedMovePct: options.expectedMovePct,
    expectedUpper: options.expectedUpper,
    expectedLower: options.expectedLower,
    putCallOi: options.putCallOi,
    maxPain: options.maxPain,
    callWall: options.callWall,
    putWall: options.putWall,
    atmIv: options.atmIv,
    marketStatus: stock.marketStatus,
  };
  await prisma.stockMetrics.upsert({
    where: { symbol_tradeDate: { symbol, tradeDate: parseYmd(stock.tradeDate) } },
    create: { symbol, tradeDate: parseYmd(stock.tradeDate), ...metricData },
    update: metricData,
  });
}

export async function importLongbridgeCandleBatch(batch: LongbridgeCandleBatch) {
  const prisma = getPrisma();
  const symbols = batch.series.map((item) => item.symbol);

  // Parsing has already validated the entire payload. This preflight also stops
  // an old plugin export from revising the database before any write occurs.
  const existingDates = await Promise.all(symbols.map(async (symbol) => ({
    symbol,
    row: await prisma.stockDaily.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" }, select: { tradeDate: true } }),
  })));
  const newer = existingDates.filter(({ row }) => row && dateToYmd(row.tradeDate) > batch.tradeDate);
  if (newer.length) throw new Error(`Longbridge import is older than stored stock data: ${newer.map(({ symbol, row }) => `${symbol}=${dateToYmd(row!.tradeDate)}`).join(", ")}`);

  let rowCount = 0;
  for (const series of batch.series) rowCount += await upsertSeries(series);
  for (const symbol of symbols) await recalculateLatestMetrics(symbol);

  const observations = await Promise.all(symbols.map(async (symbol) => {
    const [stock, metrics] = await Promise.all([
      prisma.stockDaily.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" }, select: { tradeDate: true } }),
      prisma.stockMetrics.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" }, select: { tradeDate: true } }),
    ]);
    return {
      symbol,
      fetchedLatestDate: batch.tradeDate,
      storedStockDate: stock ? dateToYmd(stock.tradeDate) : null,
      storedMetricsDate: metrics ? dateToYmd(metrics.tradeDate) : null,
    };
  }));
  const verified = validateStockSyncObservations(observations, symbols);
  return { ...verified, rowCount };
}
