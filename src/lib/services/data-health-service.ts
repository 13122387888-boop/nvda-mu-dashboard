import { unstable_cache } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { parseOptionCoverageWarnings, type UpstreamOptionCoverage } from "@/lib/data-quality";
import { dateToYmd } from "@/lib/dates";
import { getPrisma } from "@/lib/db/prisma";
import { LIMITED_STOCK_SOURCE_SYMBOLS, NON_OPTION_SYMBOLS, OPTION_SUPPORTED_SYMBOLS, SUPPORTED_SYMBOLS, type SupportedSymbol } from "@/lib/stocks";

type LatestDateRow = { symbol: string; tradeDate: Date };
type OptionStatsRow = LatestDateRow & {
  recordCount: number;
  expirationCount: number;
  strikeCount: number;
  callCount: number;
  putCount: number;
  oiCount: number;
  ivCount: number;
  gammaCount: number;
};

export type SymbolDataHealth = {
  symbol: SupportedSymbol;
  stockDate: string | null;
  metricsDate: string | null;
  optionsDate: string | null;
  stockCurrent: boolean;
  metricsAligned: boolean;
  optionsAligned: boolean;
  optionQuality: "LIMITED" | "UNAVAILABLE";
  optionStats: {
    recordCount: number;
    expirationCount: number;
    strikeCount: number;
    oiCoveragePct: number;
    ivCoveragePct: number;
    gammaCoveragePct: number;
    upstreamCoverage: UpstreamOptionCoverage | null;
  } | null;
};

export type DataHealthSummary = {
  status: "ok" | "degraded" | "error";
  asOf: string | null;
  staleBusinessDays: number | null;
  expectedSymbols: number;
  expectedOptionSymbols: number;
  currentStockSymbols: number;
  alignedMetricsSymbols: number;
  optionSymbols: number;
  alignedOptionSymbols: number;
  missingStockSymbols: SupportedSymbol[];
  missingOptionSymbols: SupportedSymbol[];
  nonOptionSymbols: SupportedSymbol[];
  limitedStockSourceSymbols: SupportedSymbol[];
  optionCoverageMode: "LIMITED_NEAR_MONEY";
  latestRun: {
    status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
    triggerType: "MANUAL" | "CRON";
    startedAt: string;
    completedAt: string | null;
    durationSeconds: number | null;
    stockRows: number;
    optionRows: number;
    metricsRows: number;
  } | null;
  symbols: SymbolDataHealth[];
};

const coveragePercent = (covered: number, total: number) => total ? Math.round(covered / total * 1_000) / 10 : 0;

function currentNewYorkDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function businessDaysAfter(date: string, today = currentNewYorkDate()) {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(`${today}T00:00:00.000Z`);
  let count = 0;
  for (const cursor = new Date(start.getTime() + 86_400_000); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) count += 1;
  }
  return count;
}

function warningsBySymbol(message: string | null) {
  const output = new Map<SupportedSymbol, string[]>();
  for (const line of message?.split("\n") ?? []) {
    const separator = line.indexOf(": ");
    if (separator < 1) continue;
    const symbol = line.slice(0, separator) as SupportedSymbol;
    if (!SUPPORTED_SYMBOLS.includes(symbol)) continue;
    output.set(symbol, [...(output.get(symbol) ?? []), line.slice(separator + 2)]);
  }
  return output;
}

export async function loadDataHealthSummary(): Promise<DataHealthSummary> {
  const prisma = getPrisma();
  const [stockDates, metricsDates, optionStats, latestRun] = await Promise.all([
    prisma.$queryRaw<LatestDateRow[]>(Prisma.sql`
      SELECT DISTINCT ON ("symbol") "symbol", "trade_date" AS "tradeDate"
      FROM "stock_daily"
      WHERE "symbol" IN (${Prisma.join(SUPPORTED_SYMBOLS)})
      ORDER BY "symbol", "trade_date" DESC
    `),
    prisma.$queryRaw<LatestDateRow[]>(Prisma.sql`
      SELECT DISTINCT ON ("symbol") "symbol", "trade_date" AS "tradeDate"
      FROM "stock_metrics"
      WHERE "symbol" IN (${Prisma.join(SUPPORTED_SYMBOLS)})
      ORDER BY "symbol", "trade_date" DESC
    `),
    prisma.$queryRaw<OptionStatsRow[]>(Prisma.sql`
      WITH latest AS (
        SELECT "symbol", MAX("trade_date") AS "trade_date"
        FROM "option_eod"
        WHERE "symbol" IN (${Prisma.join(SUPPORTED_SYMBOLS)})
        GROUP BY "symbol"
      )
      SELECT options."symbol", options."trade_date" AS "tradeDate",
        COUNT(*)::int AS "recordCount",
        COUNT(DISTINCT options."expiration")::int AS "expirationCount",
        COUNT(DISTINCT options."strike")::int AS "strikeCount",
        COUNT(*) FILTER (WHERE options."option_type" = 'CALL')::int AS "callCount",
        COUNT(*) FILTER (WHERE options."option_type" = 'PUT')::int AS "putCount",
        COUNT(*) FILTER (WHERE options."open_interest" IS NOT NULL AND options."open_interest" >= 0)::int AS "oiCount",
        COUNT(*) FILTER (WHERE options."implied_volatility" IS NOT NULL AND options."implied_volatility" >= 0)::int AS "ivCount",
        COUNT(*) FILTER (WHERE options."gamma" IS NOT NULL)::int AS "gammaCount"
      FROM "option_eod" options
      JOIN latest ON latest."symbol" = options."symbol" AND latest."trade_date" = options."trade_date"
      GROUP BY options."symbol", options."trade_date"
    `),
    prisma.syncRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);

  const stockDateMap = new Map(stockDates.map((row) => [row.symbol as SupportedSymbol, dateToYmd(row.tradeDate)]));
  const metricsDateMap = new Map(metricsDates.map((row) => [row.symbol as SupportedSymbol, dateToYmd(row.tradeDate)]));
  const optionStatsMap = new Map(optionStats.map((row) => [row.symbol as SupportedSymbol, row]));
  const coverageWarnings = warningsBySymbol(latestRun?.errorMessage ?? null);
  const asOf = [...stockDateMap.values()].sort().at(-1) ?? null;

  const symbols = SUPPORTED_SYMBOLS.map((symbol): SymbolDataHealth => {
    const stockDate = stockDateMap.get(symbol) ?? null;
    const metricsDate = metricsDateMap.get(symbol) ?? null;
    const stats = optionStatsMap.get(symbol) ?? null;
    const optionsDate = stats ? dateToYmd(stats.tradeDate) : null;
    const optionWarnings = coverageWarnings.get(symbol) ?? [];
    return {
      symbol,
      stockDate,
      metricsDate,
      optionsDate,
      stockCurrent: stockDate !== null && stockDate === asOf,
      metricsAligned: stockDate !== null && metricsDate === stockDate,
      optionsAligned: stockDate !== null && optionsDate === stockDate,
      optionQuality: stats ? "LIMITED" : "UNAVAILABLE",
      optionStats: stats ? {
        recordCount: stats.recordCount,
        expirationCount: stats.expirationCount,
        strikeCount: stats.strikeCount,
        oiCoveragePct: coveragePercent(stats.oiCount, stats.recordCount),
        ivCoveragePct: coveragePercent(stats.ivCount, stats.recordCount),
        gammaCoveragePct: coveragePercent(stats.gammaCount, stats.recordCount),
        upstreamCoverage: parseOptionCoverageWarnings(optionWarnings),
      } : null,
    };
  });

  const staleBusinessDays = asOf ? businessDaysAfter(asOf) : null;
  const currentStockSymbols = symbols.filter((item) => item.stockCurrent).length;
  const alignedMetricsSymbols = symbols.filter((item) => item.metricsAligned).length;
  const optionSymbols = symbols.filter((item) => OPTION_SUPPORTED_SYMBOLS.includes(item.symbol) && item.optionsDate !== null).length;
  const alignedOptionSymbols = symbols.filter((item) => OPTION_SUPPORTED_SYMBOLS.includes(item.symbol) && item.optionsAligned).length;
  const missingStockSymbols = symbols.filter((item) => !item.stockDate).map((item) => item.symbol);
  const missingOptionSymbols = symbols.filter((item) => OPTION_SUPPORTED_SYMBOLS.includes(item.symbol) && !item.optionsDate).map((item) => item.symbol);
  const runningTooLong = latestRun?.status === "RUNNING" && Date.now() - latestRun.startedAt.getTime() > 8 * 60_000;
  const hasOperationalIssue = !asOf
    || (staleBusinessDays !== null && staleBusinessDays > 1)
    || currentStockSymbols !== SUPPORTED_SYMBOLS.length
    || alignedMetricsSymbols !== SUPPORTED_SYMBOLS.length
    || optionSymbols !== OPTION_SUPPORTED_SYMBOLS.length
    || alignedOptionSymbols !== OPTION_SUPPORTED_SYMBOLS.length
    || !latestRun
    || latestRun.status === "FAILED"
    || latestRun.status === "PARTIAL"
    || runningTooLong;

  return {
    status: !asOf ? "error" : hasOperationalIssue ? "degraded" : "ok",
    asOf,
    staleBusinessDays,
    expectedSymbols: SUPPORTED_SYMBOLS.length,
    expectedOptionSymbols: OPTION_SUPPORTED_SYMBOLS.length,
    currentStockSymbols,
    alignedMetricsSymbols,
    optionSymbols,
    alignedOptionSymbols,
    missingStockSymbols,
    missingOptionSymbols,
    nonOptionSymbols: [...NON_OPTION_SYMBOLS],
    limitedStockSourceSymbols: [...LIMITED_STOCK_SOURCE_SYMBOLS],
    optionCoverageMode: "LIMITED_NEAR_MONEY",
    latestRun: latestRun ? {
      status: latestRun.status,
      triggerType: latestRun.triggerType,
      startedAt: latestRun.startedAt.toISOString(),
      completedAt: latestRun.completedAt?.toISOString() ?? null,
      durationSeconds: latestRun.completedAt ? Math.round((latestRun.completedAt.getTime() - latestRun.startedAt.getTime()) / 1_000) : null,
      stockRows: latestRun.stockRows,
      optionRows: latestRun.optionRows,
      metricsRows: latestRun.metricsRows,
    } : null,
    symbols,
  };
}

const getCachedDataHealthSummary = unstable_cache(loadDataHealthSummary, ["data-health-v1"], { revalidate: 300, tags: ["stock-dashboard"] });

export function getDataHealthSummary() {
  return getCachedDataHealthSummary();
}
