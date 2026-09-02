import { addDays, dateToYmd, parseYmd } from "@/lib/dates";
import { getPrisma } from "@/lib/db/prisma";
import { assessOptionDataQuality, assessStockDataQuality, optionSnapshotRegression, type OptionDataQuality, type StockDataQuality } from "@/lib/data-quality";
import { sanitizeError } from "@/lib/env";
import { Prisma } from "@/generated/prisma/client";
import { calculateOptionMetrics } from "@/lib/indicators/options/option-metrics";
import { calculateStockMetrics } from "@/lib/indicators/stock-metrics";
import { OnclickMediaProvider } from "@/lib/providers/onclickmedia/onclickmedia-provider";
import type { OptionContractRecord, StockDailyRecord, SupportedSymbol } from "@/lib/providers/types";
import { LIMITED_STOCK_SOURCE_SYMBOLS, NON_OPTION_SYMBOLS, STOCK_HISTORY_START_DATES, SUPPORTED_SYMBOLS } from "@/lib/stocks";
import { loadRecentOptionSnapshot } from "@/lib/sync/recent-option-snapshot";

const SYMBOLS: SupportedSymbol[] = SUPPORTED_SYMBOLS;
const CREATE_BATCH_SIZE = 200;
// Keep the cron comfortably below Vercel's five-minute limit as the watchlist
// grows, while remaining gentle on the upstream provider.
const SYNC_CONCURRENCY = 3;

type SymbolSyncResult = {
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  stockRows: number;
  optionRows: number;
  metricsRows: number;
  stockDate: string | null;
  optionsDate: string | null;
  warnings: string[];
  dataQuality: {
    stock: StockDataQuality;
    options: OptionDataQuality;
  };
};

export type SyncSummary = {
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  startedAt: string;
  completedAt: string;
  symbols: Record<SupportedSymbol, SymbolSyncResult>;
};

function chunks<T>(rows: T[]): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < rows.length; index += CREATE_BATCH_SIZE) output.push(rows.slice(index, index + CREATE_BATCH_SIZE));
  return output;
}

async function upsertStockRows(rows: StockDailyRecord[]) {
  const prisma = getPrisma();
  const data = rows.map((row) => ({
    symbol: row.symbol,
    tradeDate: parseYmd(row.tradeDate),
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    adjustedClose: row.adjustedClose,
    volume: row.volume === null ? null : BigInt(row.volume),
    provider: row.provider,
  }));
  for (const batch of chunks(data)) await prisma.stockDaily.createMany({ data: batch, skipDuplicates: true });

  // Providers can revise their most recent EOD bars. Refresh a small tail without
  // wrapping cross-region calls in a transaction that can expire at five seconds.
  for (const row of rows.slice(-8)) {
    // createMany above inserted missing rows. The conditional update is atomic:
    // an OnclickMedia option refresh can never replace a same-day Longbridge
    // close, even if both jobs overlap. Longbridge remains allowed to revise
    // either source when this helper is reused by a fallback importer.
    await prisma.stockDaily.updateMany({
      where: {
        symbol: row.symbol,
        tradeDate: parseYmd(row.tradeDate),
        ...(row.provider === "LONGBRIDGE" ? {} : { provider: { not: "LONGBRIDGE" } }),
      },
      data: {
        open: row.open, high: row.high, low: row.low, close: row.close, adjustedClose: row.adjustedClose,
        volume: row.volume === null ? null : BigInt(row.volume), provider: row.provider,
      },
    });
  }
}

export async function replaceOptionSnapshots(rows: OptionContractRecord[]) {
  const prisma = getPrisma();
  const data = rows.map((row) => ({
    symbol: row.symbol,
    tradeDate: parseYmd(row.tradeDate),
    expiration: parseYmd(row.expiration),
    optionType: row.optionType,
    strike: row.strike,
    contractSymbol: row.contractSymbol,
    contractMultiplier: row.contractMultiplier,
    bid: row.bid,
    ask: row.ask,
    last: row.last,
    volume: row.volume === null ? null : BigInt(row.volume),
    openInterest: row.openInterest === null ? null : BigInt(row.openInterest),
    impliedVolatility: row.impliedVolatility,
    delta: row.delta,
    gamma: row.gamma,
    theta: row.theta,
    vega: row.vega,
    provider: row.provider,
  }));
  const snapshots = new Map<string, typeof data>();
  for (const row of data) {
    const key = `${row.symbol}|${dateToYmd(row.tradeDate)}`;
    const group = snapshots.get(key) ?? [];
    group.push(row);
    snapshots.set(key, group);
  }

  // The provider can revise OI, quotes and Greeks after an early EOD snapshot.
  // Replace one symbol/date snapshot in a single statement so readers never see
  // a half-deleted chain and same-day revisions are not ignored.
  for (const snapshot of snapshots.values()) {
    const first = snapshot[0];
    const [existing] = await prisma.$queryRaw<Array<{ recordCount: number; expirationCount: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS "recordCount", COUNT(DISTINCT "expiration")::int AS "expirationCount"
      FROM "option_eod"
      WHERE "symbol" = ${first.symbol} AND "trade_date" = ${first.tradeDate}
    `);
    const regression = optionSnapshotRegression(
      existing ?? { recordCount: 0, expirationCount: 0 },
      { recordCount: snapshot.length, expirationCount: new Set(snapshot.map((row) => row.expiration.getTime())).size },
    );
    if (regression) throw new Error(`Option snapshot downgrade blocked: ${regression}`);
    const values = snapshot.map((row) => Prisma.sql`(
      ${row.symbol}, ${row.tradeDate}, ${row.expiration}, ${row.optionType}::"OptionType", ${row.strike},
      ${row.contractSymbol}, ${row.contractMultiplier}, ${row.bid}, ${row.ask}, ${row.last}, ${row.volume},
      ${row.openInterest}, ${row.impliedVolatility}, ${row.delta}, ${row.gamma}, ${row.theta}, ${row.vega}, ${row.provider}, NOW(), NOW()
    )`);
    const keys = snapshot.map((row) => Prisma.sql`(${row.expiration}::date, ${row.optionType}::"OptionType", ${row.strike}::numeric)`);
    await prisma.$executeRaw(Prisma.sql`
      WITH upserted AS (
        INSERT INTO "option_eod" (
          "symbol", "trade_date", "expiration", "option_type", "strike", "contract_symbol",
          "contract_multiplier", "bid", "ask", "last", "volume", "open_interest",
          "implied_volatility", "delta", "gamma", "theta", "vega", "provider", "created_at", "updated_at"
        ) VALUES ${Prisma.join(values)}
        ON CONFLICT ("symbol", "trade_date", "expiration", "option_type", "strike") DO UPDATE SET
          "contract_symbol" = EXCLUDED."contract_symbol",
          "contract_multiplier" = EXCLUDED."contract_multiplier",
          "bid" = EXCLUDED."bid",
          "ask" = EXCLUDED."ask",
          "last" = EXCLUDED."last",
          "volume" = EXCLUDED."volume",
          "open_interest" = EXCLUDED."open_interest",
          "implied_volatility" = EXCLUDED."implied_volatility",
          "delta" = EXCLUDED."delta",
          "gamma" = EXCLUDED."gamma",
          "theta" = EXCLUDED."theta",
          "vega" = EXCLUDED."vega",
          "provider" = EXCLUDED."provider",
          "updated_at" = EXCLUDED."updated_at"
        RETURNING 1
      )
      DELETE FROM "option_eod"
      WHERE "symbol" = ${first.symbol}
        AND "trade_date" = ${first.tradeDate}
        AND ("expiration", "option_type", "strike") NOT IN (VALUES ${Prisma.join(keys)})
    `);
  }
}

function compactProviderWarnings(warnings: string[]) {
  const skippedRows = warnings.filter((warning) => /^Skipped invalid option row\b/i.test(warning));
  const retained = warnings.filter((warning) => !/^Skipped invalid option row\b/i.test(warning));
  if (skippedRows.length) retained.push(`Skipped ${skippedRows.length} invalid option rows`);
  return retained;
}

async function loadStockHistory(symbol: SupportedSymbol): Promise<StockDailyRecord[]> {
  const rows = await getPrisma().stockDaily.findMany({
    where: { symbol },
    orderBy: { tradeDate: "desc" },
    take: 260,
  });
  return rows.reverse().map((row) => ({
    symbol,
    tradeDate: dateToYmd(row.tradeDate),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    adjustedClose: row.adjustedClose === null ? null : Number(row.adjustedClose),
    volume: row.volume === null ? null : Number(row.volume),
    provider: "ONCLICKMEDIA",
  }));
}

async function syncSymbol(symbol: SupportedSymbol, mode: "bootstrap" | "incremental"): Promise<SymbolSyncResult> {
  const provider = new OnclickMediaProvider();
  const prisma = getPrisma();
  const warnings: string[] = [];
  let stockRows = 0;
  let optionRows = 0;
  let metricsRows = 0;
  let stockDate: string | null = null;
  let optionsDate: string | null = null;
  let stockOk = false;
  let optionsOk = false;
  const optionsExpected = !(NON_OPTION_SYMBOLS as readonly SupportedSymbol[]).includes(symbol);
  let stockQuality = assessStockDataQuality([], { expectedSymbol: symbol });
  let optionQuality = assessOptionDataQuality([], { expectedSymbol: symbol, sourceCoverage: "LIMITED_NEAR_MONEY" });

  try {
    const latestAvailable = await provider.getLatestAvailableStockDate(symbol);
    if (!latestAvailable) throw new Error("No stock date is available");
    const existing = mode === "incremental"
      ? await prisma.stockDaily.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" }, select: { tradeDate: true } })
      : null;
    const requestedStart = existing ? addDays(dateToYmd(existing.tradeDate), -7) : addDays(latestAvailable, -450);
    const knownHistoryStart = STOCK_HISTORY_START_DATES[symbol];
    const startDate = knownHistoryStart && requestedStart < knownHistoryStart ? knownHistoryStart : requestedStart;
    const result = await provider.getStockDailyHistory({ symbol, startDate, endDate: latestAvailable });
    stockQuality = assessStockDataQuality(result.records, { expectedSymbol: symbol, expectedLatestDate: latestAvailable });
    if (stockQuality.level === "FAILED") throw new Error(`Stock data quality failed: ${stockQuality.reasons.join("; ")}`);
    await upsertStockRows(result.records);
    stockRows = result.records.length;
    stockDate = stockQuality.stats.latestDate ?? latestAvailable;
    warnings.push(...result.warnings);
    stockOk = true;
  } catch (error) {
    const providerError = sanitizeError(error);
    if ((LIMITED_STOCK_SOURCE_SYMBOLS as readonly SupportedSymbol[]).includes(symbol)) {
      const [stored, marketLatest] = await Promise.all([
        prisma.stockDaily.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" }, select: { tradeDate: true } }),
        prisma.stockDaily.aggregate({ where: { symbol: { in: SUPPORTED_SYMBOLS } }, _max: { tradeDate: true } }),
      ]);
      if (stored && marketLatest._max.tradeDate && stored.tradeDate.getTime() === marketLatest._max.tradeDate.getTime()) {
        stockDate = dateToYmd(stored.tradeDate);
        stockQuality = {
          level: "LIMITED",
          reasons: ["Primary provider is unsupported; retained the current fallback-provider close"],
          stats: { recordCount: 0, latestDate: stockDate },
        };
        stockOk = true;
        warnings.push(`Stock source limited: ${providerError}; retained current fallback close ${stockDate}`);
      } else {
        warnings.push(`Stock: ${providerError}`);
      }
    } else {
      warnings.push(`Stock: ${providerError}`);
    }
  }

  let optionRecords: OptionContractRecord[] = [];
  if (optionsExpected) {
    try {
      const result = await provider.getLatestOptionChain({ symbol });
      optionQuality = assessOptionDataQuality(result.records, { expectedSymbol: symbol, warnings: result.warnings, sourceCoverage: "LIMITED_NEAR_MONEY" });
      if (optionQuality.level === "FAILED") throw new Error(`Option data quality failed: ${optionQuality.reasons.join("; ")}`);
      optionRecords = result.records;
      await replaceOptionSnapshots(optionRecords);
      optionRows = optionRecords.length;
      optionsDate = optionQuality.stats.tradeDate;
      warnings.push(...compactProviderWarnings(result.warnings));
      optionsOk = true;
    } catch (error) {
      optionRecords = [];
      warnings.push(`Options: ${sanitizeError(error)}`);
    }
  } else {
    optionQuality = {
      level: "GOOD",
      reasons: ["No listed option chain is expected for this symbol"],
      stats: { tradeDate: null, recordCount: 0, expirationCount: 0, strikeCount: 0, callCount: 0, putCount: 0, oiCoveragePct: 0, ivCoveragePct: 0, gammaCoveragePct: 0, upstreamCoverage: null },
    };
    optionsOk = true;
  }

  try {
    const history = await loadStockHistory(symbol);
    const stock = calculateStockMetrics(history);
    if (!stock) throw new Error("No stock history is available for metric calculation");
    optionRecords = [];
    if (optionsExpected) {
      const snapshot = await loadRecentOptionSnapshot(symbol, stock.tradeDate);
      if (snapshot.rows.length) {
        optionRecords = snapshot.rows.map((row) => ({
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
        optionsDate = snapshot.tradeDate;
        // Reusing one recent snapshot keeps research charts populated, but the
        // sync itself remains partial until the option date catches up.
        optionsOk = snapshot.tradeDate === stock.tradeDate;
        if (snapshot.tradeDate !== stock.tradeDate) {
          warnings.push(`Options: using recent ${snapshot.tradeDate} snapshot for ${stock.tradeDate} stock close`);
        }
      }
    }
    if (optionsExpected && !optionRecords.length) {
      optionsOk = false;
      warnings.push(`Options: no recent snapshot is available for the ${stock.tradeDate} stock close`);
    }
    const optionReferenceClose = optionsDate
      ? history.find((row) => row.tradeDate === optionsDate)?.adjustedClose
        ?? history.find((row) => row.tradeDate === optionsDate)?.close
        ?? stock.close
      : stock.close;
    const options = calculateOptionMetrics(optionRecords, optionReferenceClose);
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
    metricsRows = 1;
  } catch (error) {
    warnings.push(`Metrics: ${sanitizeError(error)}`);
  }

  const status = stockOk && optionsOk && metricsRows === 1 ? "SUCCESS" : stockOk || optionsOk || metricsRows === 1 ? "PARTIAL" : "FAILED";
  return { status, stockRows, optionRows, metricsRows, stockDate, optionsDate, warnings, dataQuality: { stock: stockQuality, options: optionQuality } };
}

export async function runSync(input: { triggerType: "MANUAL" | "CRON"; mode: "bootstrap" | "incremental" }): Promise<SyncSummary> {
  const prisma = getPrisma();
  const startedAt = new Date();
  const abandonedBefore = new Date(startedAt.getTime() - 8 * 60_000);
  await prisma.syncRun.updateMany({
    where: { status: "RUNNING", startedAt: { lt: abandonedBefore } },
    data: { status: "FAILED", completedAt: startedAt, errorMessage: "Sync exceeded the execution window and was marked as abandoned" },
  });
  const activeRun = await prisma.syncRun.findFirst({ where: { status: "RUNNING", startedAt: { gte: abandonedBefore } }, select: { id: true } });
  if (activeRun) throw new Error("A data sync is already running");
  const run = await prisma.syncRun.create({
    data: { triggerType: input.triggerType, status: "RUNNING", symbols: SYMBOLS },
  });
  const results = {} as Record<SupportedSymbol, SymbolSyncResult>;

  try {
    for (let index = 0; index < SYMBOLS.length; index += SYNC_CONCURRENCY) {
      const batch = SYMBOLS.slice(index, index + SYNC_CONCURRENCY);
      await Promise.all(batch.map(async (symbol) => {
        console.info(`[SYNC] ${symbol} (${input.mode})`);
        results[symbol] = await syncSymbol(symbol, input.mode);
        console.info(`[SYNC] ${symbol} status=${results[symbol].status} stock=${results[symbol].stockRows} options=${results[symbol].optionRows}`);
      }));
    }

    const statuses = Object.values(results).map((result) => result.status);
    const status = statuses.every((value) => value === "SUCCESS")
      ? "SUCCESS"
      : statuses.every((value) => value === "FAILED")
        ? "FAILED"
        : "PARTIAL";
    const completedAt = new Date();
    const allWarnings = SYMBOLS.flatMap((symbol) => results[symbol].warnings.map((warning) => `${symbol}: ${warning}`));

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status,
        completedAt,
        stockRows: Object.values(results).reduce((sum, result) => sum + result.stockRows, 0),
        optionRows: Object.values(results).reduce((sum, result) => sum + result.optionRows, 0),
        metricsRows: Object.values(results).reduce((sum, result) => sum + result.metricsRows, 0),
        errorMessage: allWarnings.length ? allWarnings.join("\n").slice(0, 16_000) : null,
      },
    });

    return { status, startedAt: startedAt.toISOString(), completedAt: completedAt.toISOString(), symbols: results };
  } catch (error) {
    await prisma.syncRun.update({
      where: { id: run.id },
      data: { status: "FAILED", completedAt: new Date(), errorMessage: sanitizeError(error) },
    }).catch(() => undefined);
    throw error;
  }
}
