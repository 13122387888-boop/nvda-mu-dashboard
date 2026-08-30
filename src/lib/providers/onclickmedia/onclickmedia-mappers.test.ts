import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/option-chain.json";
import { mapOptionChain, mapStockBars, mapStockTradeDate, normalizeIv } from "./onclickmedia-mappers";

describe("OnclickMedia adapter", () => {
  it("maps interval-end timestamps back to the market date", () => {
    expect(mapStockTradeDate("2026-08-25 12:00 AM")).toBe("2026-08-24");
    expect(mapStockTradeDate("2026-08-24")).toBe("2026-08-24");
  });

  it("maps adjusted daily OHLCV and filters invalid numbers", () => {
    const result = mapStockBars([
      { timestamp: "2026-08-25 12:00 AM", open: "100", high: 102, low: 99, close: 101, volume: 500 },
      { timestamp: "bad", open: 1, high: 1, low: 1, close: "NaN" },
    ], "NVDA");
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({ tradeDate: "2026-08-24", close: 101, adjustedClose: 101, volume: 500 });
    expect(result.warnings).toHaveLength(1);
  });

  it("maps option fields, sides, IV units and nulls", () => {
    const result = mapOptionChain(fixture, "NVDA");
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({
      optionType: "CALL",
      strike: 210,
      contractSymbol: "NVDA--260828C00210000",
      impliedVolatility: 0.45,
    });
    expect(result.records[1]).toMatchObject({ optionType: "PUT", contractSymbol: null, impliedVolatility: null, openInterest: null });
    expect(result.warnings.some((warning) => warning.includes("Skipped"))).toBe(true);
  });

  it("normalizes OnclickMedia's BRKB option underlying to BRK.B", () => {
    const result = mapOptionChain([{
      symbol: "BRKB",
      contract_id: "BRKB--260918C00500000",
      date: "2026-08-28",
      expiration: "2026-09-18",
      strike: 500,
      type: "call",
      open_interest: 120,
      greeks: { implied_volatility: 0.21, gamma: 0.01 },
    }], "BRK.B");

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      symbol: "BRK.B",
      contractSymbol: "BRKB--260918C00500000",
      optionType: "CALL",
      strike: 500,
    });
    expect(result.warnings).toEqual([]);
  });

  it("keeps decimal IV and converts percentage IV", () => {
    expect(normalizeIv(0.45)).toBe(0.45);
    expect(normalizeIv(45)).toBe(0.45);
    expect(normalizeIv("Infinity")).toBeNull();
  });
});
