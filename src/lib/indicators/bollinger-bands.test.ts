import { describe, expect, it } from "vitest";
import {
  bollingerBandsSeries,
  calculateBollingerBands,
  summarizeBollingerBands,
} from "./bollinger-bands";

describe("calculateBollingerBands", () => {
  it("uses a 20-session population standard deviation", () => {
    const result = calculateBollingerBands(Array.from({ length: 20 }, (_, index) => index + 1));

    expect(result.middle).toBe(10.5);
    expect(result.upper).toBeCloseTo(22.0325625947, 8);
    expect(result.lower).toBeCloseTo(-1.0325625947, 8);
    expect(result.percentB).toBeCloseTo(0.9118772355, 8);
    expect(result.bandwidth).toBeCloseTo(2.1966785895, 8);
  });

  it("returns null fields until the requested period is available", () => {
    expect(calculateBollingerBands([1, 2, 3], 4)).toEqual({
      middle: null,
      upper: null,
      lower: null,
      percentB: null,
      bandwidth: null,
    });
  });

  it("keeps a zero-width band while leaving percent B unavailable", () => {
    expect(calculateBollingerBands(Array(20).fill(8))).toEqual({
      middle: 8,
      upper: 8,
      lower: 8,
      percentB: null,
      bandwidth: 0,
    });
  });
});

describe("bollingerBandsSeries", () => {
  it("aligns every calculated point to its input date index", () => {
    const result = bollingerBandsSeries([1, 2, 3, 4, 5], 3, 1);

    expect(result).toHaveLength(5);
    expect(result[1].middle).toBeNull();
    expect(result[2].middle).toBe(2);
    expect(result[4].middle).toBe(4);
  });
});

describe("summarizeBollingerBands", () => {
  const point = (bandwidth: number) => ({
    middle: 100,
    upper: 100 + bandwidth * 50,
    lower: 100 - bandwidth * 50,
    percentB: 0.5,
    bandwidth,
  });

  it("classifies the current bandwidth against at most 252 valid observations", () => {
    const series = Array.from({ length: 300 }, (_, index) => point(index + 1));
    const result = summarizeBollingerBands(series);

    expect(result.sampleSize).toBe(252);
    expect(result.bandwidthPercentile).toBe(100);
    expect(result.state).toBe("WIDE");
  });

  it("marks low-percentile bandwidth as a squeeze", () => {
    const result = summarizeBollingerBands([
      ...Array.from({ length: 19 }, (_, index) => point(index + 2)),
      point(1),
    ]);

    expect(result.bandwidthPercentile).toBe(5);
    expect(result.state).toBe("SQUEEZE");
  });

  it("keeps the bands but withholds a state when history is too short", () => {
    const result = summarizeBollingerBands([point(0.1), point(0.2)]);

    expect(result.middle).toBe(100);
    expect(result.bandwidthPercentile).toBeNull();
    expect(result.state).toBe("UNAVAILABLE");
    expect(result.sampleSize).toBe(2);
  });
});
