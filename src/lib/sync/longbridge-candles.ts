import { isYmd } from "@/lib/dates";
import { isSupportedSymbol, type SupportedSymbol } from "@/lib/stocks";

type JsonObject = Record<string, unknown>;

export type NormalizedLongbridgeCandle = {
  tradeDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: bigint;
};

export type LongbridgeCandleSeries = {
  symbol: SupportedSymbol;
  candles: NormalizedLongbridgeCandle[];
};

export type LongbridgeCandleBatch = {
  tradeDate: string;
  series: LongbridgeCandleSeries[];
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSymbol(value: unknown): SupportedSymbol {
  if (typeof value !== "string" || !value.trim()) throw new Error("Each Longbridge series needs a symbol");
  const upper = value.trim().toUpperCase();
  const symbol = upper.endsWith(".US") ? upper.slice(0, -3) : upper;
  if (!isSupportedSymbol(symbol)) throw new Error(`Unsupported symbol in Longbridge payload: ${value}`);
  return symbol;
}

function parseCandlesValue(value: unknown, symbol: SupportedSymbol): unknown[] {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw new Error(`Candles for ${symbol} are not valid JSON`);
    }
  }
  if (!Array.isArray(parsed) || !parsed.length) throw new Error(`No Longbridge daily bars were provided for ${symbol}`);
  return parsed;
}

function parsePrice(value: unknown, field: "open" | "high" | "low" | "close", context: string) {
  if (typeof value !== "number" && typeof value !== "string") throw new Error(`${context} has no ${field} price`);
  const parsed = typeof value === "number" ? value : Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${context} has an invalid ${field} price`);
  return parsed;
}

function parseVolume(value: unknown, context: string) {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${context} has an invalid volume`);
    return BigInt(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return BigInt(value.trim());
  throw new Error(`${context} has an invalid volume`);
}

function parseTradeDate(row: JsonObject, context: string) {
  const values = [row.timestamp, row.time].filter((value): value is string => typeof value === "string" && value.length >= 10);
  if (!values.length) throw new Error(`${context} has neither timestamp nor time`);
  const dates = [...new Set(values.map((value) => value.slice(0, 10)))];
  if (dates.length !== 1 || !isYmd(dates[0]!)) throw new Error(`${context} has an invalid or conflicting market date`);
  return dates[0]!;
}

function normalizeCandle(value: unknown, symbol: SupportedSymbol, index: number): NormalizedLongbridgeCandle {
  const context = `${symbol} candle ${index + 1}`;
  if (!isObject(value)) throw new Error(`${context} is not an object`);
  const tradeDate = parseTradeDate(value, context);
  const open = parsePrice(value.open, "open", context);
  const high = parsePrice(value.high, "high", context);
  const low = parsePrice(value.low, "low", context);
  const close = parsePrice(value.close, "close", context);
  if (high < Math.max(open, low, close) || low > Math.min(open, high, close)) {
    throw new Error(`${context} has inconsistent OHLC prices`);
  }
  return { tradeDate, open, high, low, close, volume: parseVolume(value.volume, context) };
}

function readSeries(payload: JsonObject) {
  if ("adjustment" in payload || "adjust_type" in payload || "adjustType" in payload) {
    const adjustment = payload.adjustment ?? payload.adjust_type ?? payload.adjustType;
    if (typeof adjustment !== "string" || !["forward", "forward_adjusted"].includes(adjustment.trim().toLowerCase())) {
      throw new Error("Longbridge candle payload must use forward adjustment");
    }
  }

  if ("series" in payload) {
    if (!Array.isArray(payload.series) || !payload.series.length) throw new Error("Longbridge payload series must be a non-empty array");
    return payload.series.map((entry, index) => {
      if (!isObject(entry)) throw new Error(`Longbridge series ${index + 1} is not an object`);
      return { symbol: entry.symbol, candles: entry.candles };
    });
  }

  if ("symbol" in payload || "candles" in payload) return [{ symbol: payload.symbol, candles: payload.candles }];

  const metadataKeys = new Set(["adjustment", "adjust_type", "adjustType"]);
  const entries = Object.entries(payload).filter(([key]) => !metadataKeys.has(key));
  if (!entries.length) throw new Error("Longbridge payload does not contain any symbol series");
  return entries.map(([symbol, candles]) => ({ symbol, candles }));
}

/**
 * Fully validates and normalizes one plugin export before persistence starts.
 * Accepted forms are `{ series: [{ symbol, candles }] }`, `{ symbol, candles }`,
 * or a symbol-to-candles map. A bare candle array is intentionally rejected
 * because it cannot be attributed safely to a security.
 */
export function parseLongbridgeCandlePayload(payload: unknown): LongbridgeCandleBatch {
  if (Array.isArray(payload)) throw new Error("A raw candle array has no symbol; wrap it in { symbol, candles }");
  if (!isObject(payload)) throw new Error("Longbridge candle payload must be a JSON object");

  const seenSymbols = new Set<SupportedSymbol>();
  const series = readSeries(payload).map((entry) => {
    const symbol = normalizeSymbol(entry.symbol);
    if (seenSymbols.has(symbol)) throw new Error(`Duplicate Longbridge series for ${symbol}`);
    seenSymbols.add(symbol);
    const candles = parseCandlesValue(entry.candles, symbol)
      .map((candle, index) => normalizeCandle(candle, symbol, index))
      .sort((left, right) => left.tradeDate.localeCompare(right.tradeDate));
    const seenDates = new Set<string>();
    for (const candle of candles) {
      if (seenDates.has(candle.tradeDate)) throw new Error(`Duplicate Longbridge daily bar for ${symbol} on ${candle.tradeDate}`);
      seenDates.add(candle.tradeDate);
    }
    return { symbol, candles };
  });

  const latestDates = new Set(series.map((item) => item.candles.at(-1)!.tradeDate));
  if (latestDates.size !== 1) {
    const details = series.map((item) => `${item.symbol}=${item.candles.at(-1)!.tradeDate}`);
    throw new Error(`Longbridge latest dates are not aligned: ${details.join(", ")}`);
  }

  return { tradeDate: [...latestDates][0]!, series };
}
