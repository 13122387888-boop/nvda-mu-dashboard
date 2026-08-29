import { describe, expect, it } from "vitest";

import {
  isQuietStrength,
  isStructuralChange,
  matchesSignal,
  primaryChangeScore,
  sortCards,
  type HomeScannerInput,
} from "./home-scanner";

const card = (
  overrides: Partial<HomeScannerInput> = {},
): HomeScannerInput => ({
  symbol: "NVDA",
  assetType: "STOCK",
  trendScore: 70,
  trendConfidence: { level: "HIGH" },
  ivPercentile: { percentile: 30, sampleSize: 8, label: "LOW" },
  gammaRegime: "POSITIVE",
  close: 100,
  relativeVolume: 1,
  dayOverDay: {
    trendScoreDelta: 0,
    gamma: { previous: "POSITIVE", current: "POSITIVE" },
    callWall: { delta: 0 },
    relativeVolume: { relativeVolume: 1 },
    expectedRange: { state: "UNCHANGED" },
  },
  ...overrides,
});

const withDayOverDay = (
  input: HomeScannerInput,
  dayOverDay: NonNullable<HomeScannerInput["dayOverDay"]>,
): HomeScannerInput => ({
  ...input,
  dayOverDay: {
    ...input.dayOverDay,
    ...dayOverDay,
  },
});

describe("isQuietStrength", () => {
  it("accepts the exact trend, IV, and sample-size boundaries", () => {
    expect(isQuietStrength(card())).toBe(true);
  });

  it("accepts medium trend confidence", () => {
    expect(
      isQuietStrength(card({ trendConfidence: { level: "MEDIUM" } })),
    ).toBe(true);
  });

  it.each([
    ["trend below 70", { trendScore: 69.99 }],
    ["IV above 30", { ivPercentile: { percentile: 30.01, sampleSize: 8 } }],
    ["negative IV sentinel", { ivPercentile: { percentile: -1, sampleSize: 8 } }],
    ["fewer than eight samples", { ivPercentile: { percentile: 30, sampleSize: 7 } }],
    ["low confidence", { trendConfidence: { level: "LOW" as const } }],
    ["missing confidence", { trendConfidence: null }],
    ["missing IV", { ivPercentile: null }],
    ["non-finite trend", { trendScore: Number.NaN }],
  ])("rejects %s", (_label, overrides) => {
    expect(isQuietStrength(card(overrides))).toBe(false);
  });
});

describe("isStructuralChange", () => {
  it.each([10, -10, 15.5, -15.5])(
    "detects an absolute trend delta of %s",
    (trendScoreDelta) => {
      expect(
        isStructuralChange(
          withDayOverDay(card(), { trendScoreDelta }),
        ),
      ).toBe(true);
    },
  );

  it("detects a valid gamma-regime switch case-insensitively", () => {
    expect(
      isStructuralChange(
        withDayOverDay(card(), {
          gamma: { previous: " positive ", current: "negative" },
        }),
      ),
    ).toBe(true);
  });

  it.each([
    [{ previous: "POSITIVE", current: "POSITIVE" }, false],
    [{ previous: null, current: "NEGATIVE" }, false],
    [{ previous: "UNKNOWN", current: "NEGATIVE" }, false],
    [{ previous: "POSITIVE", current: "N/A" }, false],
    [{ previous: "POSITIVE", current: "NEUTRAL" }, true],
  ] as const)("validates gamma transition %o", (gamma, expected) => {
    expect(
      isStructuralChange(withDayOverDay(card(), { gamma })),
    ).toBe(expected);
  });

  it("detects call-wall movement at the 2% boundary in either direction", () => {
    expect(
      isStructuralChange(
        withDayOverDay(card({ close: 100 }), { callWall: { delta: 2 } }),
      ),
    ).toBe(true);
    expect(
      isStructuralChange(
        withDayOverDay(card({ close: 100 }), { callWall: { delta: -2 } }),
      ),
    ).toBe(true);
  });

  it("ignores call-wall movement without a valid positive close", () => {
    expect(
      isStructuralChange(
        withDayOverDay(card({ close: 0 }), { callWall: { delta: 10 } }),
      ),
    ).toBe(false);
    expect(
      isStructuralChange(
        withDayOverDay(card({ close: null }), { callWall: { delta: 10 } }),
      ),
    ).toBe(false);
  });

  it("uses day-over-day RVOL, with the card-level value as a fallback", () => {
    expect(
      isStructuralChange(
        withDayOverDay(card({ relativeVolume: 1 }), {
          relativeVolume: { relativeVolume: 1.5 },
        }),
      ),
    ).toBe(true);
    expect(
      isStructuralChange(
        withDayOverDay(card({ relativeVolume: 1.5 }), {
          relativeVolume: null,
        }),
      ),
    ).toBe(true);
  });

  it("returns false when every metric is below its threshold", () => {
    expect(
      isStructuralChange(
        withDayOverDay(card({ close: 100, relativeVolume: 1.49 }), {
          trendScoreDelta: -9.99,
          gamma: { previous: "NEGATIVE", current: "NEGATIVE" },
          callWall: { delta: 1.99 },
          relativeVolume: { relativeVolume: 1.49 },
        }),
      ),
    ).toBe(false);
  });
});

describe("matchesSignal", () => {
  it("matches ALL unconditionally", () => {
    expect(matchesSignal(card({ trendScore: null }), "ALL")).toBe(true);
  });

  it("delegates the two composed signals to their predicates", () => {
    const quiet = card();
    const changing = withDayOverDay(
      card({ trendScore: 20, trendConfidence: { level: "LOW" } }),
      { trendScoreDelta: 12 },
    );

    expect(matchesSignal(quiet, "QUIET_STRENGTH")).toBe(true);
    expect(matchesSignal(changing, "QUIET_STRENGTH")).toBe(false);
    expect(matchesSignal(quiet, "STRUCTURAL_CHANGE")).toBe(false);
    expect(matchesSignal(changing, "STRUCTURAL_CHANGE")).toBe(true);
  });
});

describe("primaryChangeScore", () => {
  it("normalizes and adds all four change dimensions", () => {
    const changing = withDayOverDay(
      card({ close: 200 }),
      {
        trendScoreDelta: -20,
        gamma: { previous: "POSITIVE", current: "NEGATIVE" },
        callWall: { delta: -8 },
        relativeVolume: { relativeVolume: 2 },
      },
    );

    // gamma 1 + trend 2 + wall 2 + RVOL 2
    expect(primaryChangeScore(changing)).toBeCloseTo(7);
  });

  it("returns zero for missing and invalid metrics", () => {
    expect(
      primaryChangeScore(
        card({
          trendScore: null,
          close: Number.NaN,
          relativeVolume: Number.NaN,
          dayOverDay: null,
        }),
      ),
    ).toBe(0);
  });

  it("does not reward below-normal RVOL", () => {
    expect(
      primaryChangeScore(
        withDayOverDay(card(), {
          relativeVolume: { relativeVolume: 0.5 },
        }),
      ),
    ).toBe(0);
  });
});

describe("sortCards", () => {
  it("sorts TREND descending, puts missing scores last, and breaks ties by symbol", () => {
    const cards = [
      card({ symbol: "MSFT", trendScore: 70 }),
      card({ symbol: "AMD", trendScore: 80 }),
      card({ symbol: "AAPL", trendScore: 70 }),
      card({ symbol: "ZZZ", trendScore: null }),
    ];

    expect(sortCards(cards, "TREND").map(({ symbol }) => symbol)).toEqual([
      "AMD",
      "AAPL",
      "MSFT",
      "ZZZ",
    ]);
    expect(cards.map(({ symbol }) => symbol)).toEqual([
      "MSFT",
      "AMD",
      "AAPL",
      "ZZZ",
    ]);
  });

  it("sorts CHANGE by the composite score and then by symbol", () => {
    const low = withDayOverDay(card({ symbol: "LOW" }), {
      trendScoreDelta: 5,
    });
    const tiedZulu = withDayOverDay(card({ symbol: "ZULU" }), {
      trendScoreDelta: 10,
    });
    const tiedAlpha = withDayOverDay(card({ symbol: "ALPHA" }), {
      relativeVolume: { relativeVolume: 1.5 },
    });
    const high = withDayOverDay(card({ symbol: "HIGH" }), {
      trendScoreDelta: 10,
      gamma: { previous: "POSITIVE", current: "NEGATIVE" },
      callWall: { delta: 2 },
    });

    expect(
      sortCards([low, tiedZulu, high, tiedAlpha], "CHANGE").map(
        ({ symbol }) => symbol,
      ),
    ).toEqual(["HIGH", "ALPHA", "ZULU", "LOW"]);
  });

  it("preserves a card subtype in the returned array", () => {
    const extended = [{ ...card(), displayName: "NVIDIA" }];
    const sorted = sortCards(extended, "TREND");

    expect(sorted[0].displayName).toBe("NVIDIA");
  });
});
