import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { SUPPORTED_SYMBOLS } from "@/lib/stocks";
import { parseLongbridgeCandlePayload } from "@/lib/sync/longbridge-candles";
const exec = promisify(execFile);
async function command(args: string[]) {
  for (let attempt = 0; ; attempt++) {
    try {
      const { stdout } = await exec("longbridge", args, {
        timeout: 60000,
        maxBuffer: 8000000,
        windowsHide: true,
      });
      return JSON.parse(stdout);
    } catch (error) {
      if (
        attempt >= 2 ||
        !/connect|network|timeout|timed out|reset|tls|ssl/i.test(String(error))
      )
        throw error;
    }
  }
}
export async function latestClosedTradingDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (key: string) => parts.find((p) => p.type === key)?.value ?? "";
  const today = part("year") + "-" + part("month") + "-" + part("day");
  const start = new Date(now.getTime() - 14 * 86400000)
    .toISOString()
    .slice(0, 10);
  const calendar = (await command([
    "trading",
    "days",
    "US",
    "--start",
    start,
    "--end",
    today,
    "--format",
    "json",
  ])) as { trading_days: string[]; half_trading_days: string[] };
  // A one-hour publication buffer avoids ingesting a still-forming daily candle.
  const days = [...calendar.trading_days, ...calendar.half_trading_days]
    .filter(
      (date) => date < today || (date === today && Number(part("hour")) >= 17),
    )
    .sort();
  const date = days.at(-1);
  if (!date) throw new Error("No completed US trading day");
  return date;
}
export async function collectLongbridgeBatch(count = 30) {
  const target = await latestClosedTradingDate();
  const series: Array<{ symbol: string; candles: unknown }> = [];
  let cursor = 0;
  async function worker() {
    while (cursor < SUPPORTED_SYMBOLS.length) {
      const index = cursor++;
      const symbol = SUPPORTED_SYMBOLS[index]!;
      const raw = await command([
        "kline",
        symbol + ".US",
        "--period",
        "day",
        "--count",
        String(count),
        "--adjust",
        "forward",
        "--session",
        "intraday",
        "--format",
        "json",
      ]);
      if (!Array.isArray(raw)) throw new Error("Invalid daily bars: " + symbol);
      const candles = raw.filter(
        (row: { time?: string; timestamp?: string }) =>
          (row.time ?? row.timestamp ?? "").slice(0, 10) <= target,
      );
      const batch = parseLongbridgeCandlePayload({
        adjustment: "forward",
        symbol,
        candles,
      });
      if (batch.tradeDate !== target)
        throw new Error(symbol + " has stale daily bars: " + batch.tradeDate);
      series[index] = { symbol, candles };
      console.log("[FETCH] " + symbol + " " + candles.length);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(4, SUPPORTED_SYMBOLS.length) }, worker),
  );
  return parseLongbridgeCandlePayload({ adjustment: "forward", series });
}
