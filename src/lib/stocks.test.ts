import { describe, expect, it } from "vitest";
import { isSupportedSymbol, STOCK_HISTORY_START_DATES, STOCKS, SUPPORTED_SYMBOLS } from "./stocks";

describe("configured stock pool", () => {
  it("contains the complete 27-symbol pool without duplicates", () => {
    expect(SUPPORTED_SYMBOLS).toHaveLength(27);
    expect(new Set(SUPPORTED_SYMBOLS).size).toBe(27);
    expect(SUPPORTED_SYMBOLS).toEqual(expect.arrayContaining([
      "SKHY", "TSM", "AAPL", "AVGO", "ORCL", "GLD", "XLF", "XLE", "XLU", "XLV",
      "MVRL", "SPCX", "CRCL", "INTC", "GOOG", "AMD", "IGV", "UVIX",
    ]));
  });

  it("classifies stocks and ETFs for homepage filtering", () => {
    const stocks = SUPPORTED_SYMBOLS.filter((symbol) => STOCKS[symbol].assetType === "STOCK");
    const etfs = SUPPORTED_SYMBOLS.filter((symbol) => STOCKS[symbol].assetType === "ETF");
    expect(stocks).toHaveLength(15);
    expect(etfs).toHaveLength(12);
    expect(stocks).toEqual(expect.arrayContaining([
      "SKHY", "TSM", "AAPL", "AVGO", "ORCL", "SPCX", "CRCL", "INTC", "GOOG", "AMD",
    ]));
    expect(etfs).toEqual(expect.arrayContaining([
      "GLD", "XLF", "XLE", "XLU", "XLV", "MVRL", "IGV", "UVIX",
    ]));
  });

  it("recognizes the new symbols and protects recent listings' actual history starts", () => {
    expect(isSupportedSymbol("SKHY")).toBe(true);
    expect(isSupportedSymbol("XLV")).toBe(true);
    expect(isSupportedSymbol("SPCX")).toBe(true);
    expect(isSupportedSymbol("MVRL")).toBe(true);
    expect(isSupportedSymbol("UNKNOWN")).toBe(false);
    expect(STOCK_HISTORY_START_DATES.SKHY).toBe("2026-07-10");
    expect(STOCK_HISTORY_START_DATES.SPCX).toBe("2026-06-12");
    expect(STOCK_HISTORY_START_DATES.CRCL).toBe("2025-06-05");
  });
});
