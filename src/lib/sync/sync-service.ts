import { addDays, dateToYmd, parseYmd } from "@/lib/dates";
import { getPrisma } from "@/lib/db/prisma";
import { sanitizeError } from "@/lib/env";
import { calculateOptionMetrics } from "@/lib/indicators/options/option-metrics";
import { calculateStockMetrics } from "@/lib/indicators/stock-metrics";
import { OnclickMediaProvider } from "@/lib/providers/onclickmedia/onclickmedia-provider";
import type { OptionContractRecord, StockDailyRecord, SupportedSymbol } from "@/lib/providers/types";
import { SUPPORTED_SYMBOLS } from "@/lib/stocks";

const SYMBOLS: SupportedSymbol[] = SUPPORTED_SYMBOLS;
const CREATE_BATCH_SIZE = 200;

type SymbolSyncResult = {
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  stockRows: number;
  optionRows: number;
  metricsRows: number;
  stockDate: string | null;
  optionsDate: string | null;
  warnings: string[];
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
    await prisma.stockDaily.upsert({
      where: { symbol_tradeDate: { symbol: row.symbol, tradeDate: parseYmd(row.tradeDate) } },
      create: {
        symbol: row.symbol, tradeDate: parseYmd(row.tradeDate), open: row.open, high: row.high, low: row.low,
        close: row.close, adjustedClose: row.adjustedClose, volume: row.volume === null ? null : BigInt(row.volume), provider: row.provider,
      },
      update: {
        open: row.open, high: row.high, low: row.low, close: row.close, adjustedClose: row.adjustedClose,
        volume: row.volume === null ? null : BigInt(row.volume), provider: row.provider,
      },
    });
  }
}

async function upsertOptionRows(rows: OptionContractRecord[]) {
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
  for (const batch of chunks(data)) await prisma.optionEod.createMany({ data: batch, skipDuplicates: true });
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

  try {
    const latestAvailable = await provider.getLatestAvailableStockDate(symbol);
    if (!latestAvailable) throw new Error("No stock date is available");
    const existing = mode === "incremental"
      ? await prisma.stockDaily.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" }, select: { tradeDate: true } })
      : null;
    const startDate = existing ? addDays(dateToYmd(existing.tradeDate), -7) : addDays(latestAvailable, -450);
    const result = await provider.getStockDailyHistory({ symbol, startDate, endDate: latestAvailable });
    await upsertStockRows(result.records);
    stockRows = result.records.length;
    stockDate = result.records.at(-1)?.tradeDate ?? latestAvailable;
    warnings.push(...result.warnings);
    stockOk = true;
  } catch (error) {
    warnings.push(`Stock: ${sanitizeError(error)}`);
  }

  let optionRecords: OptionContractRecord[] = [];
  try {
    const result = await provider.getLatestOptionChain({ symbol });
    optionRecords = result.records;
    if (!optionRecords.length) throw new Error("No accessible EOD option contracts were returned");
    await upsertOptionRows(optionRecords);
    optionRows = optionRecords.length;
    optionsDate = optionRecords[0].tradeDate;
    warnings.push(...result.warnings);
    optionsOk = true;
  } catch (error) {
    warnings.push(`Options: ${sanitizeError(error)}`);
  }

  try {
    const history = await loadStockHistory(symbol);
    const stock = calculateStockMetrics(history);
    if (!stock) throw new Error("No stock history is available for metric calculation");
    if (!optionRecords.length) {
      const latestOption = await prisma.optionEod.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" }, select: { tradeDate: true } });
      if (latestOption) {
        const rows = await prisma.optionEod.findMany({ where: { symbol, tradeDate: latestOption.tradeDate } });
        optionRecords = rows.map((row) => ({
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
      }
    }
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
    metricsRows = 1;
  } catch (error) {
    warnings.push(`Metrics: ${sanitizeError(error)}`);
  }

  const status = stockOk && optionsOk && metricsRows === 1 ? "SUCCESS" : stockOk || optionsOk || metricsRows === 1 ? "PARTIAL" : "FAILED";
  return { status, stockRows, optionRows, metricsRows, stockDate, optionsDate, warnings };
}

export async function runSync(input: { triggerType: "MANUAL" | "CRON"; mode: "bootstrap" | "incremental" }): Promise<SyncSummary> {
  const prisma = getPrisma();
  const startedAt = new Date();
  const run = await prisma.syncRun.create({
    data: { triggerType: input.triggerType, status: "RUNNING", symbols: SYMBOLS },
  });
  const results = {} as Record<SupportedSymbol, SymbolSyncResult>;

  for (const symbol of SYMBOLS) {
    console.info(`[SYNC] ${symbol} (${input.mode})`);
    results[symbol] = await syncSymbol(symbol, input.mode);
    console.info(`[SYNC] ${symbol} status=${results[symbol].status} stock=${results[symbol].stockRows} options=${results[symbol].optionRows}`);
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
      errorMessage: allWarnings.length ? allWarnings.join("\n").slice(0, 4000) : null,
    },
  });

  return { status, startedAt: startedAt.toISOString(), completedAt: completedAt.toISOString(), symbols: results };
}
