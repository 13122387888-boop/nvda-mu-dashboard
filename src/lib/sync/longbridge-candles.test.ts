import { describe, expect, it } from "vitest";
import { parseLongbridgeCandlePayload } from "@/lib/sync/longbridge-candles";

const timestampCandle = {
  timestamp: "2026-08-31T04:00:00Z",
  open: "510.380",
  high: "512.190",
  low: "506.390",
  close: "507.290",
  volume: 27_208_911,
};

describe("parseLongbridgeCandlePayload", () => {
  it("normalizes the plugin timestamp and numeric volume", () => {
    const batch = parseLongbridgeCandlePayload({
      adjustment: "forward",
      series: [{ symbol: "MSFT.US", candles: [timestampCandle] }],
    });

    expect(batch.tradeDate).toBe("2026-08-31");
    expect(batch.series[0]).toEqual({
      symbol: "MSFT",
      candles: [{
        tradeDate: "2026-08-31",
        open: 510.38,
        high: 512.19,
        low: 506.39,
        close: 507.29,
        volume: 27_208_911n,
      }],
    });
  });

  it("accepts a symbol map, time, string volumes, and JSON-encoded candle arrays", () => {
    const batch = parseLongbridgeCandlePayload({
      NVDA: [{ ...timestampCandle, timestamp: undefined, time: "2026-08-31 00:00:00", volume: "432100" }],
      MU: JSON.stringify([{ ...timestampCandle, timestamp: undefined, time: "2026-08-31", volume: "123456" }]),
    });

    expect(batch.series.map((item) => item.symbol)).toEqual(["NVDA", "MU"]);
    expect(batch.series[0]!.candles[0]!.volume).toBe(432_100n);
  });

  it("sorts bars but rejects duplicate dates", () => {
    const sorted = parseLongbridgeCandlePayload({ symbol: "NVDA", candles: [
      timestampCandle,
      { ...timestampCandle, timestamp: "2026-08-28T04:00:00Z" },
    ] });
    expect(sorted.series[0]!.candles.map((row) => row.tradeDate)).toEqual(["2026-08-28", "2026-08-31"]);

    expect(() => parseLongbridgeCandlePayload({ symbol: "NVDA", candles: [
      timestampCandle,
      { ...timestampCandle },
    ] })).toThrow("Duplicate Longbridge daily bar for NVDA on 2026-08-31");
  });

  it("rejects unsupported and duplicate normalized symbols", () => {
    expect(() => parseLongbridgeCandlePayload({ symbol: "NOPE", candles: [timestampCandle] }))
      .toThrow("Unsupported symbol in Longbridge payload: NOPE");
    expect(() => parseLongbridgeCandlePayload({ series: [
      { symbol: "NVDA", candles: [timestampCandle] },
      { symbol: "nvda.us", candles: [timestampCandle] },
    ] })).toThrow("Duplicate Longbridge series for NVDA");
  });

  it("rejects an invalid later series before returning a batch", () => {
    expect(() => parseLongbridgeCandlePayload({ series: [
      { symbol: "NVDA", candles: [timestampCandle] },
      { symbol: "MU", candles: [{ ...timestampCandle, high: "500" }] },
    ] })).toThrow("MU candle 1 has inconsistent OHLC prices");
  });

  it("rejects unaligned latest dates and non-forward metadata", () => {
    expect(() => parseLongbridgeCandlePayload({ series: [
      { symbol: "NVDA", candles: [timestampCandle] },
      { symbol: "MU", candles: [{ ...timestampCandle, timestamp: "2026-08-28T04:00:00Z" }] },
    ] })).toThrow("Longbridge latest dates are not aligned: NVDA=2026-08-31, MU=2026-08-28");
    expect(() => parseLongbridgeCandlePayload({ adjustment: "none", symbol: "NVDA", candles: [timestampCandle] }))
      .toThrow("Longbridge candle payload must use forward adjustment");
  });

  it("rejects a bare plugin response because it has no symbol", () => {
    expect(() => parseLongbridgeCandlePayload([timestampCandle]))
      .toThrow("A raw candle array has no symbol");
  });
});
