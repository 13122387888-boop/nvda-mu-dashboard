import { execFile } from "node:child_process";
import { promisify } from "node:util";
import nextEnv from "@next/env";
import { getPrisma } from "@/lib/db/prisma";
import { parseYmd, todayYmd } from "@/lib/dates";
import { isSupportedSymbol, SUPPORTED_SYMBOLS, type SupportedSymbol } from "@/lib/stocks";

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

async function loadCandles(symbol: SupportedSymbol, start: string, end: string) {
  const { stdout } = await execFileAsync("longbridge", [
    "kline", "history", `${symbol}.US`,
    "--start", start,
    "--end", end,
    "--period", "day",
    "--adjust", "forward",
    "--format", "json",
  ], { maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  return JSON.parse(stdout) as LongbridgeCandle[];
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
  console.info(`[BACKFILL] ${symbol} fetched=${candles.length} inserted=${result.count}`);
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

  for (const symbol of symbols) await backfillSymbol(symbol, start, end);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
