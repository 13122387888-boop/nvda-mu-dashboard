import { unstable_cache } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { dateToYmd } from "@/lib/dates";
import { getPrisma } from "@/lib/db/prisma";
import { SUPPORTED_SYMBOLS } from "@/lib/stocks";
export function businessDaysAfter(
  date: string,
  today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date()),
) {
  let count = 0;
  for (
    const cursor = new Date(date + "T00:00:00Z");
    cursor.toISOString().slice(0, 10) < today;
  ) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) count++;
  }
  return count;
}
export async function loadDataHealthSummary() {
  const prisma = getPrisma();
  const [rows, metrics, latestRun] = await Promise.all([
    prisma.$queryRaw<
      Array<{ symbol: string; tradeDate: Date; count: bigint }>
    >(Prisma.sql`
      SELECT "symbol", MAX("trade_date") AS "tradeDate", COUNT(*) AS "count"
      FROM "stock_daily" WHERE "provider" = 'LONGBRIDGE'
      AND "symbol" IN (${Prisma.join(SUPPORTED_SYMBOLS)}) GROUP BY "symbol"
    `),
    prisma.stockMetrics.findMany({
      where: { symbol: { in: SUPPORTED_SYMBOLS } },
      distinct: ["symbol"],
      orderBy: { tradeDate: "desc" },
      select: { symbol: true, tradeDate: true },
    }),
    prisma.syncRun.findFirst({
      where: { optionRows: 0 },
      orderBy: { startedAt: "desc" },
    }),
  ]);
  const asOf =
    rows
      .map((row) => dateToYmd(row.tradeDate))
      .sort()
      .at(-1) ?? null;
  const symbols = SUPPORTED_SYMBOLS.map((symbol) => {
    const row = rows.find((row) => row.symbol === symbol);
    const metric = metrics.find((row) => row.symbol === symbol);
    return {
      symbol,
      stockDate: row ? dateToYmd(row.tradeDate) : null,
      metricsDate: metric ? dateToYmd(metric.tradeDate) : null,
      metricsAligned:
        !!row &&
        !!metric &&
        dateToYmd(row.tradeDate) === dateToYmd(metric.tradeDate),
      historyCount: Number(row?.count ?? 0),
      stockCurrent: !!row && dateToYmd(row.tradeDate) === asOf,
    };
  });
  const currentStockSymbols = symbols.filter((row) => row.stockCurrent).length;
  const alignedMetricsSymbols = symbols.filter(
    (row) => row.metricsAligned,
  ).length;
  const staleBusinessDays = asOf ? businessDaysAfter(asOf) : null;
  return {
    source: "LONGBRIDGE",
    status: !asOf
      ? "error"
      : currentStockSymbols === SUPPORTED_SYMBOLS.length &&
          alignedMetricsSymbols === SUPPORTED_SYMBOLS.length &&
          (staleBusinessDays ?? 99) <= 1
        ? "ok"
        : "degraded",
    asOf,
    staleBusinessDays,
    expectedSymbols: SUPPORTED_SYMBOLS.length,
    currentStockSymbols,
    alignedMetricsSymbols,
    missingStockSymbols: symbols
      .filter((row) => !row.stockDate)
      .map((row) => row.symbol),
    latestRun: latestRun
      ? {
          status: latestRun.status,
          startedAt: latestRun.startedAt.toISOString(),
          completedAt: latestRun.completedAt?.toISOString() ?? null,
          stockRows: latestRun.stockRows,
        }
      : null,
    symbols,
  };
}
export type DataHealthSummary = Awaited<
  ReturnType<typeof loadDataHealthSummary>
>;
export const getDataHealthSummary = unstable_cache(
  loadDataHealthSummary,
  ["longbridge-health-v1"],
  { revalidate: 30, tags: ["stock-dashboard"] },
);
