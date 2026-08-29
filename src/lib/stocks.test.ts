import { describe, expect, it } from "vitest";
import { isSupportedSymbol, STOCK_HISTORY_START_DATES, STOCKS, SUPPORTED_SYMBOLS } from "./stocks";

describe("configured stock pool", () => {
  it("contains the complete 19-symbol pool without duplicates", () => {
    expect(SUPPORTED_SYMBOLS).toHaveLength(19);
    expect(new Set(SUPPORTED_SYMBOLS).size).toBe(19);
    expect(SUPPORTED_SYMBOLS).toEqual(expect.arrayContaining([
      "SKHY", "TSM", "AAPL", "AVGO", "ORCL", "GLD", "XLF", "XLE", "XLU", "XLV",
    ]));
  });

  it("classifies stocks and ETFs for homepage filtering", () => {
    const stocks = SUPPORTED_SYMBOLS.filter((symbol) => STOCKS[symbol].assetType === "STOCK");
    const etfs = SUPPORTED_SYMBOLS.filter((symbol) => STOCKS[symbol].assetType === "ETF");
    expect(stocks).toHaveLength(10);
    expect(etfs).toHaveLength(9);
    expect(stocks).toEqual(expect.arrayContaining(["SKHY", "TSM", "AAPL", "AVGO", "ORCL"]));
    expect(etfs).toEqual(expect.arrayContaining(["GLD", "XLF", "XLE", "XLU", "XLV"]));
  });

  it("recognizes the new symbols and protects SKHY's actual history start", () => {
    expect(isSupportedSymbol("SKHY")).toBe(true);
    expect(isSupportedSymbol("XLV")).toBe(true);
    expect(isSupportedSymbol("UNKNOWN")).toBe(false);
    expect(STOCK_HISTORY_START_DATES.SKHY).toBe("2026-07-10");
  });
});
