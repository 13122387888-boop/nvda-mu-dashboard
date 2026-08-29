export type BollingerBandsPoint = {
  middle: number | null;
  upper: number | null;
  lower: number | null;
  percentB: number | null;
  bandwidth: number | null;
};

export type BollingerState = "SQUEEZE" | "WIDE" | "NORMAL" | "UNAVAILABLE";

export type BollingerBandsSummary = BollingerBandsPoint & {
  bandwidthPercentile: number | null;
  state: BollingerState;
  sampleSize: number;
};

const EMPTY_POINT: BollingerBandsPoint = {
  middle: null,
  upper: null,
  lower: null,
  percentB: null,
  bandwidth: null,
};

export function calculateBollingerBands(
  values: number[],
  period = 20,
  standardDeviations = 2,
): BollingerBandsPoint {
  if (
    !Number.isInteger(period)
    || period <= 0
    || !Number.isFinite(standardDeviations)
    || standardDeviations < 0
    || values.length < period
  ) {
    return { ...EMPTY_POINT };
  }

  const window = values.slice(-period);
  if (window.some((value) => !Number.isFinite(value))) return { ...EMPTY_POINT };

  const middle = window.reduce((sum, value) => sum + value, 0) / period;
  // BOLL(20, 2) uses the population standard deviation of the 20 prices.
  const variance = window.reduce((sum, value) => sum + (value - middle) ** 2, 0) / period;
  const standardDeviation = Math.sqrt(variance);
  const upper = middle + standardDeviations * standardDeviation;
  const lower = middle - standardDeviations * standardDeviation;
  const bandRange = upper - lower;
  const close = window.at(-1)!;

  return {
    middle,
    upper,
    lower,
    percentB: bandRange === 0 ? null : (close - lower) / bandRange,
    bandwidth: middle === 0 ? null : bandRange / Math.abs(middle),
  };
}

export function bollingerBandsSeries(
  values: number[],
  period = 20,
  standardDeviations = 2,
): BollingerBandsPoint[] {
  return values.map((_, index) => calculateBollingerBands(
    values.slice(Math.max(0, index - period + 1), index + 1),
    period,
    standardDeviations,
  ));
}

export function summarizeBollingerBands(
  series: BollingerBandsPoint[],
  lookback = 252,
  minimumSamples = 20,
): BollingerBandsSummary {
  const current = series.at(-1) ?? EMPTY_POINT;
  const safeLookback = Math.max(Math.trunc(lookback), 0);
  const validBandwidths = series
    .map((point) => point.bandwidth)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const bandwidthSamples = safeLookback === 0 ? [] : validBandwidths.slice(-safeLookback);
  const sampleSize = bandwidthSamples.length;

  if (
    current.middle === null
    || current.upper === null
    || current.lower === null
    || current.bandwidth === null
    || sampleSize < minimumSamples
  ) {
    return {
      ...current,
      bandwidthPercentile: null,
      state: "UNAVAILABLE",
      sampleSize,
    };
  }

  const atOrBelow = bandwidthSamples.filter((value) => value <= current.bandwidth!).length;
  const bandwidthPercentile = Math.round((atOrBelow / sampleSize) * 100);
  const state: BollingerState = bandwidthPercentile <= 20
    ? "SQUEEZE"
    : bandwidthPercentile >= 80
      ? "WIDE"
      : "NORMAL";

  return {
    ...current,
    bandwidthPercentile,
    state,
    sampleSize,
  };
}
