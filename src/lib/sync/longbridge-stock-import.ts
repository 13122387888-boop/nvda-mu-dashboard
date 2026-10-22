import { Prisma } from "@/generated/prisma/client";
import { dateToYmd, parseYmd } from "@/lib/dates";
import { getPrisma } from "@/lib/db/prisma";
import { calculateStockMetrics } from "@/lib/indicators/stock-metrics";
import type { StockDailyRecord } from "@/lib/providers/types";
import type { LongbridgeCandleBatch } from "./longbridge-candles";
import { validateStockSyncObservations } from "./stock-sync-validation";

export async function importLongbridgeCandleBatch(
  batch: LongbridgeCandleBatch,
) {
  const prisma = getPrisma();
  const symbols = batch.series.map((item) => item.symbol);
  const existing = await prisma.stockDaily.findMany({
    where: { symbol: { in: symbols }, provider: "LONGBRIDGE" },
    distinct: ["symbol"],
    orderBy: { tradeDate: "desc" },
    select: { symbol: true, tradeDate: true },
  });
  if (existing.some((row) => dateToYmd(row.tradeDate) > batch.tradeDate))
    throw new Error("Import is older than stored Longbridge data");
  const run = await prisma.syncRun.create({
    data: { triggerType: "MANUAL", status: "RUNNING", symbols },
  });
  try {
    let rowCount = 0;
    // The complete batch has already passed validation. One transaction prevents a partial universe.
    await prisma.$transaction(
      async (tx) => {
        for (const series of batch.series) {
          const values = series.candles.map(
            (row) => Prisma.sql`(
          ${series.symbol},${parseYmd(row.tradeDate)},${row.open},${row.high},${row.low},${row.close},${row.close},${row.volume},'LONGBRIDGE',NOW(),NOW()
        )`,
          );
          rowCount += await tx.$executeRaw(Prisma.sql`
          INSERT INTO "stock_daily" ("symbol","trade_date","open","high","low","close","adjusted_close","volume","provider","created_at","updated_at")
          VALUES ${Prisma.join(values)}
          ON CONFLICT ("symbol","trade_date") DO UPDATE SET
          "open"=EXCLUDED."open","high"=EXCLUDED."high","low"=EXCLUDED."low","close"=EXCLUDED."close",
          "adjusted_close"=EXCLUDED."adjusted_close","volume"=EXCLUDED."volume","provider"=EXCLUDED."provider","updated_at"=NOW()
        `);
          const rows = await tx.stockDaily.findMany({
            where: { symbol: series.symbol, provider: "LONGBRIDGE" },
            orderBy: { tradeDate: "desc" },
            take: 520,
          });
          const history: StockDailyRecord[] = rows.reverse().map((row) => ({
            symbol: series.symbol,
            tradeDate: dateToYmd(row.tradeDate),
            open: Number(row.open),
            high: Number(row.high),
            low: Number(row.low),
            close: Number(row.close),
            adjustedClose:
              row.adjustedClose === null ? null : Number(row.adjustedClose),
            volume: row.volume === null ? null : Number(row.volume),
            provider: "LONGBRIDGE",
          }));
          const m = calculateStockMetrics(history);
          if (!m || m.tradeDate !== batch.tradeDate)
            throw new Error("Metrics date mismatch: " + series.symbol);
          const data = {
            close: m.close,
            dailyChange: m.dailyChange,
            dailyChangePct: m.dailyChangePct,
            ma20: m.ma20,
            ma50: m.ma50,
            ma200: m.ma200,
            rsi14: m.rsi14,
            rv20: m.rv20,
            marketStatus: m.marketStatus,
            optionsTradeDate: null,
            optionsExpiration: null,
            expectedMove: null,
            expectedMovePct: null,
            expectedUpper: null,
            expectedLower: null,
            putCallOi: null,
            maxPain: null,
            callWall: null,
            putWall: null,
            atmIv: null,
          };
          await tx.stockMetrics.upsert({
            where: {
              symbol_tradeDate: {
                symbol: series.symbol,
                tradeDate: parseYmd(m.tradeDate),
              },
            },
            create: {
              symbol: series.symbol,
              tradeDate: parseYmd(m.tradeDate),
              ...data,
            },
            update: data,
          });
        }
      },
      { timeout: 180000, maxWait: 15000 },
    );
    const observations = await Promise.all(
      symbols.map(async (symbol) => {
        const [stock, metrics] = await Promise.all([
          prisma.stockDaily.findFirst({
            where: { symbol, provider: "LONGBRIDGE" },
            orderBy: { tradeDate: "desc" },
          }),
          prisma.stockMetrics.findFirst({
            where: { symbol },
            orderBy: { tradeDate: "desc" },
          }),
        ]);
        return {
          symbol,
          fetchedLatestDate: batch.tradeDate,
          storedStockDate: stock ? dateToYmd(stock.tradeDate) : null,
          storedMetricsDate: metrics ? dateToYmd(metrics.tradeDate) : null,
        };
      }),
    );
    const verified = validateStockSyncObservations(observations, symbols);
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        completedAt: new Date(),
        stockRows: rowCount,
        metricsRows: symbols.length,
      },
    });
    return { ...verified, rowCount };
  } catch (error) {
    await prisma.syncRun
      .update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage: "Longbridge import failed",
        },
      })
      .catch(() => undefined);
    throw error;
  }
}
