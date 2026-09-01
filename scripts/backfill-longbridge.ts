import { execFile } from "node:child_process";
import { promisify } from "node:util";
import nextEnv from "@next/env";
import { getPrisma } from "@/lib/db/prisma";
import { dateToYmd, parseYmd, todayYmd } from "@/lib/dates";
import { calculateOptionMetrics } from "@/lib/indicators/options/option-metrics";
import { calculateStockMetrics } from "@/lib/indicators/stock-metrics";
import type { OptionContractRecord, StockDailyRecord } from "@/lib/providers/types";
import { isSupportedSymbol, SUPPORTED_SYMBOLS, type SupportedSymbol } from "@/lib/stocks";
import { validateStockSyncObservations } from "@/lib/sync/stock-sync-validation";

const execFileAsync = promisify(execFile);
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const prisma = getPrisma();

type LongbridgeCandle = {
  close: string;
  high: string;
  low: string;
  open: string;
  time: string;
  volume: string;
};

const MAX_ATTEMPTS = 3;

async function loadCandles(symbol: SupportedSymbol, start: string, end: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const { stdout } = await execFileAsync("longbridge", [
        "kline", "history", `${symbol}.US`,
        "--start", start,
        "--end", end,
        "--period", "day",
        "--adjust", "forward",
        "--format", "json",
      ], { maxBuffer: 16 * 1024 * 1024, timeout: 30_000, windowsHide: true });
      const candles = JSON.parse(stdout) as LongbridgeCandle[];
      if (!candles.length) throw new Error(`No Longbridge daily bars were returned for ${symbol}`);
      return candles;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

async function backfillSymbol(symbol: SupportedSymbol, start: string, end: string) {
  const candles = await loadCandles(symbol, start, end);
  const result = await prisma.stockDaily.createMany({
    data: candles.map((candle) => ({
      symbol,
      tradeDate: parseYmd(candle.time.slice(0, 10)),
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
      adjustedClose: Number(candle.close),
      volume: BigInt(candle.volume),
      provider: "LONGBRIDGE",
    })),
    skipDuplicates: true,
  });
  for (const candle of candles.slice(-8)) {
    await prisma.stockDaily.upsert({
      where: { symbol_tradeDate: { symbol, tradeDate: parseYmd(candle.time.slice(0, 10)) } },
      create: {
        symbol, tradeDate: parseYmd(candle.time.slice(0, 10)), open: Number(candle.open), high: Number(candle.high),
        low: Number(candle.low), close: Number(candle.close), adjustedClose: Number(candle.close), volume: BigInt(candle.volume), provider: "LONGBRIDGE",
      },
      update: {
        open: Number(candle.open), high: Number(candle.high), low: Number(candle.low), close: Number(candle.close),
        adjustedClose: Number(candle.close), volume: BigInt(candle.volume), provider: "LONGBRIDGE",
      },
    });
  }
  await recalculateLatestMetrics(symbol);
  console.info(`[BACKFILL] ${symbol} fetched=${candles.length} inserted=${result.count} refreshed=${Math.min(candles.length, 8)}`);
  return candleDate(candles.at(-1));
}

function candleDate(candle: LongbridgeCandle | undefined) {
  return candle?.time.slice(0, 10) ?? null;
}

async function recalculateLatestMetrics(symbol: SupportedSymbol) {
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
  if (!stock) return;
  const matchingOption = await prisma.optionEod.findFirst({ where: { symbol, tradeDate: parseYmd(stock.tradeDate) }, select: { tradeDate: true } });
  const optionRows = matchingOption ? await prisma.optionEod.findMany({ where: { symbol, tradeDate: matchingOption.tradeDate } }) : [];
  const options = calculateOptionMetrics(optionRows.map((row): OptionContractRecord => ({
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
  })), stock.close);
  await prisma.stockMetrics.upsert({
    where: { symbol_tradeDate: { symbol, tradeDate: parseYmd(stock.tradeDate) } },
    create: {
      symbol, tradeDate: parseYmd(stock.tradeDate), optionsTradeDate: options.optionsTradeDate ? parseYmd(options.optionsTradeDate) : null,
      optionsExpiration: options.optionsExpiration ? parseYmd(options.optionsExpiration) : null, close: stock.close,
      dailyChange: stock.dailyChange, dailyChangePct: stock.dailyChangePct, ma20: stock.ma20, ma50: stock.ma50, ma200: stock.ma200,
      rsi14: stock.rsi14, rv20: stock.rv20, expectedMove: options.expectedMove, expectedMovePct: options.expectedMovePct,
      expectedUpper: options.expectedUpper, expectedLower: options.expectedLower, putCallOi: options.putCallOi, maxPain: options.maxPain,
      callWall: options.callWall, putWall: options.putWall, atmIv: options.atmIv, marketStatus: stock.marketStatus,
    },
    update: {
      optionsTradeDate: options.optionsTradeDate ? parseYmd(options.optionsTradeDate) : null,
      optionsExpiration: options.optionsExpiration ? parseYmd(options.optionsExpiration) : null, close: stock.close,
      dailyChange: stock.dailyChange, dailyChangePct: stock.dailyChangePct, ma20: stock.ma20, ma50: stock.ma50, ma200: stock.ma200,
      rsi14: stock.rsi14, rv20: stock.rv20, expectedMove: options.expectedMove, expectedMovePct: options.expectedMovePct,
      expectedUpper: options.expectedUpper, expectedLower: options.expectedLower, putCallOi: options.putCallOi, maxPain: options.maxPain,
      callWall: options.callWall, putWall: options.putWall, atmIv: options.atmIv, marketStatus: stock.marketStatus,
    },
  });
}

async function main() {
  const [symbolArg = "all", startArg, endArg] = process.argv.slice(2);
  const currentYear = todayYmd().slice(0, 4);
  const start = startArg ?? `${currentYear}-01-01`;
  const end = endArg ?? todayYmd();
  const normalized = symbolArg.toUpperCase();
  const symbols = normalized === "ALL"
    ? SUPPORTED_SYMBOLS
    : isSupportedSymbol(normalized)
      ? [normalized]
      : null;
  if (!symbols) throw new Error(`Unsupported symbol: ${symbolArg}`);

  const fetchedLatestDates = new Map<SupportedSymbol, string | null>();
  for (const symbol of symbols) fetchedLatestDates.set(symbol, await backfillSymbol(symbol, start, end));

  const observations = await Promise.all(symbols.map(async (symbol) => {
    const [stock, metrics] = await Promise.all([
      prisma.stockDaily.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" }, select: { tradeDate: true } }),
      prisma.stockMetrics.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" }, select: { tradeDate: true } }),
    ]);
    return {
      symbol,
      fetchedLatestDate: fetchedLatestDates.get(symbol) ?? null,
      storedStockDate: stock ? dateToYmd(stock.tradeDate) : null,
      storedMetricsDate: metrics ? dateToYmd(metrics.tradeDate) : null,
    };
  }));
  const verified = validateStockSyncObservations(observations, symbols);
  console.info(`[VERIFY] tradeDate=${verified.tradeDate} stocks=${verified.symbolCount}/${symbols.length} metrics=${verified.symbolCount}/${symbols.length}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
