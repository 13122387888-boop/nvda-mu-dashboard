import { addDays, isYmd, todayYmd } from "@/lib/dates";
import type { MarketDataProvider } from "../market-data-provider";
import type { SupportedSymbol } from "../types";
import { OnclickMediaClient, OnclickMediaError } from "./onclickmedia-client";
import { mapIntradayBars, mapOptionChain, mapStockBars } from "./onclickmedia-mappers";
import { dateListSchema } from "./onclickmedia-schemas";

function sortedDates(raw: unknown, symbol?: string): string[] {
  const parsed = dateListSchema.safeParse(raw);
  if (!parsed.success) throw new OnclickMediaError("OnclickMedia returned an invalid date list");
  const values = Array.isArray(parsed.data)
    ? parsed.data
    : parsed.data[symbol ?? ""] ?? Object.values(parsed.data).flat();
  return values.filter(isYmd).sort();
}

function chunks(start: string, end: string, spanDays = 300): Array<[string, string]> {
  const result: Array<[string, string]> = [];
  let cursor = start;
  while (cursor <= end) {
    const chunkEnd = addDays(cursor, spanDays);
    result.push([cursor, chunkEnd < end ? chunkEnd : end]);
    cursor = addDays(chunkEnd, 1);
  }
  return result;
}

export class OnclickMediaProvider implements MarketDataProvider {
  private readonly client = new OnclickMediaClient();

  async getStockDailyHistory({ symbol, startDate, endDate }: { symbol: SupportedSymbol; startDate?: string; endDate?: string }) {
    const end = endDate ?? (await this.getLatestAvailableStockDate(symbol)) ?? todayYmd();
    const start = startDate ?? addDays(end, -430);
    const records = [];
    const warnings: string[] = [];

    for (const [from, to] of chunks(start, addDays(end, 1))) {
      try {
        const raw = await this.client.get("/stock-data/v2/adj/", {
          ticker: symbol,
          from,
          to,
          extended: "false",
          bar_size: "1d",
          data: "ohlcv",
          output: "json",
        });
        const mapped = mapStockBars(raw, symbol);
        records.push(...mapped.records.filter((row) => row.tradeDate >= start && row.tradeDate <= end));
        warnings.push(...mapped.warnings);
      } catch (error) {
        if (error instanceof OnclickMediaError && error.status === 404) {
          warnings.push(`No stock bars were available from ${from} to ${to}`);
          continue;
        }
        throw error;
      }
    }

    const byDate = new Map(records.map((record) => [record.tradeDate, record]));
    return { records: [...byDate.values()].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate)), warnings };
  }

  async getStockIntradayHistory({ symbol, startDate, endDate }: { symbol: SupportedSymbol; startDate: string; endDate: string }) {
    const raw = await this.client.get("/stock-data/v2/adj/", {
      ticker: symbol,
      from: startDate,
      to: addDays(endDate, 1),
      extended: "false",
      bar_size: "1m",
      data: "ohlcv",
      output: "json",
    });
    return mapIntradayBars(raw);
  }

  async getAvailableOptionDates(symbol: SupportedSymbol) {
    return sortedDates(await this.client.get("/options/", { ticker: symbol, list: "date" }), symbol);
  }

  async getLatestOptionChain({ symbol, tradeDate }: { symbol: SupportedSymbol; tradeDate?: string }) {
    const candidates = tradeDate
      ? [tradeDate]
      : sortedDates(await this.client.get("/options/", { ticker: symbol, list: "date" }), symbol).reverse().slice(0, 8);
    let lastError: unknown;
    for (const date of candidates) {
      try {
        const raw = await this.client.get("/options/", {
          ticker: symbol,
          date,
          data: "options_all",
          output: "json-v1",
        });
        const mapped = mapOptionChain(raw, symbol);
        if (mapped.records.length) return mapped;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError instanceof Error) throw lastError;
    return { records: [], warnings: ["No accessible EOD option chain was returned"] };
  }

  async getLatestAvailableStockDate(symbol: SupportedSymbol) {
    try {
      const raw = await this.client.get("/stock-data/v2/list/", { ticker: symbol, list: "date" });
      return sortedDates(raw).at(-1) ?? null;
    } catch (error) {
      if (!(error instanceof OnclickMediaError) || error.status !== 404) throw error;
      const end = todayYmd();
      const raw = await this.client.get("/stock-data/v2/adj/", {
        ticker: symbol,
        from: addDays(end, -14),
        to: addDays(end, 1),
        extended: "false",
        bar_size: "1d",
        data: "ohlcv",
        output: "json",
      });
      return mapStockBars(raw, symbol).records.at(-1)?.tradeDate ?? null;
    }
  }

  async getLatestAvailableOptionDate(symbol: SupportedSymbol) {
    const chain = await this.getLatestOptionChain({ symbol });
    return chain.records[0]?.tradeDate ?? null;
  }
}
