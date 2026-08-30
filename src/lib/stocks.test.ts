import { describe, expect, it } from "vitest";
import { isSupportedSymbol, STOCK_HISTORY_START_DATES, STOCKS, SUPPORTED_SYMBOLS } from "./stocks";

describe("configured stock pool", () => {
  it("contains the complete 41-symbol pool without duplicates", () => {
    expect(SUPPORTED_SYMBOLS).toHaveLength(41);
    expect(new Set(SUPPORTED_SYMBOLS).size).toBe(41);
    expect(SUPPORTED_SYMBOLS).toEqual(expect.arrayContaining([
      "SKHY", "TSM", "AAPL", "AVGO", "ORCL", "GLD", "XLF", "XLE", "XLU", "XLV",
      "MVRL", "SPCX", "CRCL", "INTC", "GOOG", "AMD", "IGV", "UVIX",
      "META", "AMZN", "ASML", "WDC", "STX", "PLTR", "XBI", "BRK.B", "LLY",
      "GLW", "COHR", "AAOI", "LITE", "BE",
    ]));
  });

  it("classifies stocks and ETFs for homepage filtering", () => {
    const stocks = SUPPORTED_SYMBOLS.filter((symbol) => STOCKS[symbol].assetType === "STOCK");
    const etfs = SUPPORTED_SYMBOLS.filter((symbol) => STOCKS[symbol].assetType === "ETF");
    expect(stocks).toHaveLength(28);
    expect(etfs).toHaveLength(13);
    expect(stocks).toEqual(expect.arrayContaining([
      "SKHY", "TSM", "AAPL", "AVGO", "ORCL", "SPCX", "CRCL", "INTC", "GOOG", "AMD",
      "META", "AMZN", "ASML", "WDC", "STX", "PLTR", "BRK.B", "LLY", "GLW", "COHR",
      "AAOI", "LITE", "BE",
    ]));
    expect(etfs).toEqual(expect.arrayContaining([
      "GLD", "XLF", "XLE", "XLU", "XLV", "MVRL", "IGV", "UVIX",
      "XBI",
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

  it("preserves the dotted BRK.B symbol through URL routing", () => {
    const encoded = encodeURIComponent("brk.b");
    const decoded = decodeURIComponent(encoded).toUpperCase();

    expect(encoded).toBe("brk.b");
    expect(`/stocks/${encodeURIComponent("BRK.B")}`).toBe("/stocks/BRK.B");
    expect(decoded).toBe("BRK.B");
    expect(isSupportedSymbol(decoded)).toBe(true);
    expect(isSupportedSymbol("brk.b")).toBe(false);
    if (!isSupportedSymbol(decoded)) throw new Error("BRK.B should be a supported route symbol");
    expect(STOCKS[decoded].shortName).toBe("伯克希尔 B");
  });
});
