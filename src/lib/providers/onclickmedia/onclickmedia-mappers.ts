import { addDays, isYmd } from "@/lib/dates";
import type { OptionContractRecord, StockDailyRecord, SupportedSymbol } from "../types";
import { optionContractSchema, stockBarSchema, warningSchema } from "./onclickmedia-schemas";

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function nonNegativeInteger(value: unknown): number | null {
  const number = finiteNumber(value);
  return number !== null && number >= 0 && Number.isSafeInteger(number) ? number : null;
}

export function mapStockTradeDate(timestamp: string): string | null {
  const date = timestamp.slice(0, 10);
  if (!isYmd(date)) return null;
  // OnclickMedia v2 daily bars are interval-end stamped at midnight on the
  // following calendar day. Convert that label back to the US market date.
  return timestamp.length > 10 ? addDays(date, -1) : date;
}

export function mapStockBars(raw: unknown, symbol: SupportedSymbol) {
  const records: StockDailyRecord[] = [];
  const warnings: string[] = [];
  if (!Array.isArray(raw)) return { records, warnings: ["Stock response was not an array"] };

  raw.forEach((item, index) => {
    const parsed = stockBarSchema.safeParse(item);
    if (!parsed.success) {
      warnings.push(`Skipped invalid stock row ${index}`);
      return;
    }
    const tradeDate = mapStockTradeDate(parsed.data.timestamp);
    const open = finiteNumber(parsed.data.open);
    const high = finiteNumber(parsed.data.high);
    const low = finiteNumber(parsed.data.low);
    const close = finiteNumber(parsed.data.close);
    if (!tradeDate || open === null || high === null || low === null || close === null) {
      warnings.push(`Skipped invalid stock row ${index}`);
      return;
    }
    records.push({
      symbol,
      tradeDate,
      open,
      high,
      low,
      close,
      adjustedClose: close,
      volume: nonNegativeInteger(parsed.data.volume),
      provider: "ONCLICKMEDIA",
    });
  });

  return { records, warnings };
}

export function normalizeIv(value: unknown): number | null {
  const number = finiteNumber(value);
  if (number === null || number < 0) return null;
  return number > 5 ? number / 100 : number;
}

export function mapOptionChain(raw: unknown, expectedSymbol: SupportedSymbol) {
  const records: OptionContractRecord[] = [];
  const warnings: string[] = [];
  if (!Array.isArray(raw)) return { records, warnings: ["Option response was not an array"] };

  raw.forEach((item, index) => {
    const warning = warningSchema.safeParse(item);
    if (warning.success) {
      warnings.push(warning.data.warning);
      return;
    }
    const parsed = optionContractSchema.safeParse(item);
    if (!parsed.success) {
      warnings.push(`Skipped invalid option row ${index}`);
      return;
    }
    const row = parsed.data;
    const strike = finiteNumber(row.strike);
    const side = row.type.toLowerCase() === "call" ? "CALL" : row.type.toLowerCase() === "put" ? "PUT" : null;
    if (row.symbol.toUpperCase() !== expectedSymbol || !isYmd(row.date) || !isYmd(row.expiration) || strike === null || strike < 0 || !side) {
      warnings.push(`Skipped invalid option row ${index}`);
      return;
    }
    const greeks = row.greeks ?? {};
    records.push({
      symbol: expectedSymbol,
      tradeDate: row.date,
      expiration: row.expiration,
      optionType: side,
      strike,
      contractSymbol: row.contract_id ?? row.contractID ?? null,
      contractMultiplier: 100,
      bid: finiteNumber(row.bid),
      ask: finiteNumber(row.ask),
      last: finiteNumber(row.last),
      volume: nonNegativeInteger(row.volume),
      openInterest: nonNegativeInteger(row.open_interest),
      impliedVolatility: normalizeIv(greeks.implied_volatility ?? row.implied_volatility),
      delta: finiteNumber(greeks.delta ?? row.delta),
      gamma: finiteNumber(greeks.gamma ?? row.gamma),
      theta: finiteNumber(greeks.theta ?? row.theta),
      vega: finiteNumber(greeks.vega ?? row.vega),
      provider: "ONCLICKMEDIA",
    });
  });

  return { records, warnings };
}
