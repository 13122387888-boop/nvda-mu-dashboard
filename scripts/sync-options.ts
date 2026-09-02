import nextEnv from "@next/env";
import { assessOptionDataQuality } from "../src/lib/data-quality";
import { dateToYmd } from "../src/lib/dates";
import { getPrisma } from "../src/lib/db/prisma";
import { optionSnapshotLagBusinessDays } from "../src/lib/indicators/options/option-snapshot-freshness";
import { OnclickMediaProvider } from "../src/lib/providers/onclickmedia/onclickmedia-provider";
import type { OptionContractRecord, SupportedSymbol } from "../src/lib/providers/types";
import { OPTION_SUPPORTED_SYMBOLS } from "../src/lib/stocks";
import { recalculateLatestMetrics } from "../src/lib/sync/longbridge-stock-import";
import { replaceOptionSnapshots } from "../src/lib/sync/sync-service";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const CONCURRENCY = 3;
const MAX_RETRIES = 2;

type CollectedSnapshot = {
  symbol: SupportedSymbol;
  records: OptionContractRecord[];
  tradeDate: string;
  warnings: string[];
};

async function withRetries<T>(operation: () => Promise<T>) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function collectSnapshot(symbol: SupportedSymbol): Promise<CollectedSnapshot> {
  const provider = new OnclickMediaProvider();
  const result = await withRetries(() => provider.getLatestOptionChain({ symbol }));
  const quality = assessOptionDataQuality(result.records, {
    expectedSymbol: symbol,
    warnings: result.warnings,
    sourceCoverage: "LIMITED_NEAR_MONEY",
  });
  if (quality.level === "FAILED" || !quality.stats.tradeDate) {
    throw new Error(`${symbol}: ${quality.reasons.join("; ") || "no usable option date"}`);
  }
  return { symbol, records: result.records, tradeDate: quality.stats.tradeDate, warnings: result.warnings };
}

async function collectAll() {
  const snapshots: CollectedSnapshot[] = [];
  for (let index = 0; index < OPTION_SUPPORTED_SYMBOLS.length; index += CONCURRENCY) {
    const batch = OPTION_SUPPORTED_SYMBOLS.slice(index, index + CONCURRENCY);
    snapshots.push(...await Promise.all(batch.map(collectSnapshot)));
  }
  return snapshots;
}

async function main() {
  const prisma = getPrisma();
  const stockDates = await Promise.all(OPTION_SUPPORTED_SYMBOLS.map(async (symbol) => {
    const row = await prisma.stockDaily.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" }, select: { tradeDate: true } });
    if (!row) throw new Error(`${symbol}: no stock close is available`);
    return { symbol, tradeDate: dateToYmd(row.tradeDate) };
  }));
  const latestStockDates = new Set(stockDates.map((row) => row.tradeDate));
  if (latestStockDates.size !== 1) throw new Error(`Stock dates are not aligned: ${stockDates.map((row) => `${row.symbol}=${row.tradeDate}`).join(", ")}`);
  const stockDate = stockDates[0]!.tradeDate;

  // Nothing is written until every expected symbol has returned a valid chain.
  const snapshots = await collectAll();
  const optionDates = new Set(snapshots.map((snapshot) => snapshot.tradeDate));
  if (optionDates.size !== 1) throw new Error(`Option dates are not aligned: ${snapshots.map((row) => `${row.symbol}=${row.tradeDate}`).join(", ")}`);
  const optionDate = snapshots[0]!.tradeDate;
  const lag = optionSnapshotLagBusinessDays(stockDate, optionDate);
  if (lag === null || lag < 0 || lag > 1) throw new Error(`Option snapshot ${optionDate} is not within one business day of stock close ${stockDate}`);

  const storedDates = await Promise.all(OPTION_SUPPORTED_SYMBOLS.map(async (symbol) => ({
    symbol,
    row: await prisma.optionEod.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" }, select: { tradeDate: true } }),
  })));
  const regressions = storedDates.filter(({ row }) => row && dateToYmd(row.tradeDate) > optionDate);
  if (regressions.length) throw new Error(`Incoming option date is older than stored data: ${regressions.map(({ symbol, row }) => `${symbol}=${dateToYmd(row!.tradeDate)}`).join(", ")}`);

  const run = await prisma.syncRun.create({ data: { triggerType: "MANUAL", status: "RUNNING", symbols: [...OPTION_SUPPORTED_SYMBOLS] } });
  try {
    const records = snapshots.flatMap((snapshot) => snapshot.records);
    await replaceOptionSnapshots(records);
    for (const symbol of OPTION_SUPPORTED_SYMBOLS) await recalculateLatestMetrics(symbol);
    const warnings = snapshots.flatMap((snapshot) => snapshot.warnings.map((warning) => `${snapshot.symbol}: ${warning}`));
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        completedAt: new Date(),
        stockRows: 0,
        optionRows: records.length,
        metricsRows: OPTION_SUPPORTED_SYMBOLS.length,
        errorMessage: warnings.length ? warnings.join("\n").slice(0, 16_000) : null,
      },
    });
    console.info(`[OPTIONS] stockDate=${stockDate} optionDate=${optionDate} symbols=${snapshots.length} rows=${records.length}`);
  } catch (error) {
    await prisma.syncRun.update({
      where: { id: run.id },
      data: { status: "FAILED", completedAt: new Date(), errorMessage: error instanceof Error ? error.message : "Option sync failed" },
    }).catch(() => undefined);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
