export type TrendConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export type HomeSignal = "ALL" | "QUIET_STRENGTH" | "STRUCTURAL_CHANGE";

export type HomeSort = "TREND" | "CHANGE";

export interface HomeScannerInput {
  readonly symbol: string;
  readonly assetType: string;
  readonly trendScore: number | null | undefined;
  readonly trendConfidence:
    | {
        readonly level: TrendConfidenceLevel | null | undefined;
      }
    | null
    | undefined;
  readonly ivPercentile:
    | {
        readonly percentile: number | null | undefined;
        readonly sampleSize: number | null | undefined;
        readonly label?: string | null;
      }
    | null
    | undefined;
  readonly gammaRegime: string | null | undefined;
  readonly close: number | null | undefined;
  readonly relativeVolume: number | null | undefined;
  readonly dayOverDay:
    | {
        readonly trendScoreDelta?: number | null;
        readonly gamma?:
          | {
              readonly previous?: string | null;
              readonly current?: string | null;
            }
          | null;
        readonly callWall?:
          | {
              readonly delta?: number | null;
            }
          | null;
        readonly relativeVolume?:
          | {
              readonly relativeVolume?: number | null;
            }
          | null;
        /** Reserved for the expected-range day-over-day state shown by the card. */
        readonly expectedRange?:
          | {
              readonly state?: string | null;
            }
          | null;
      }
    | null
    | undefined;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const unavailableGammaRegimes = new Set([
  "",
  "UNKNOWN",
  "UNAVAILABLE",
  "INSUFFICIENT_DATA",
  "N/A",
  "NA",
  "NONE",
  "NULL",
]);

const normalizedGammaRegime = (value: string | null | undefined) => {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toUpperCase();
  return unavailableGammaRegimes.has(normalized) ? null : normalized;
};

const hasEffectiveGammaSwitch = (card: HomeScannerInput) => {
  const previous = normalizedGammaRegime(card.dayOverDay?.gamma?.previous);
  const current = normalizedGammaRegime(card.dayOverDay?.gamma?.current);

  return previous !== null && current !== null && previous !== current;
};

const callWallMoveRatio = (card: HomeScannerInput) => {
  const close = card.close;
  const delta = card.dayOverDay?.callWall?.delta;

  if (!isFiniteNumber(close) || close <= 0 || !isFiniteNumber(delta)) return 0;
  return Math.abs(delta) / close;
};

const currentRelativeVolume = (card: HomeScannerInput) => {
  const dayOverDayRelativeVolume =
    card.dayOverDay?.relativeVolume?.relativeVolume;

  if (isFiniteNumber(dayOverDayRelativeVolume)) {
    return dayOverDayRelativeVolume;
  }

  return isFiniteNumber(card.relativeVolume) ? card.relativeVolume : null;
};

export const isQuietStrength = (card: HomeScannerInput) => {
  const percentile = card.ivPercentile?.percentile;
  const sampleSize = card.ivPercentile?.sampleSize;
  const confidence = card.trendConfidence?.level;

  return (
    isFiniteNumber(card.trendScore) &&
    card.trendScore >= 70 &&
    isFiniteNumber(percentile) &&
    percentile >= 0 &&
    percentile <= 30 &&
    isFiniteNumber(sampleSize) &&
    sampleSize >= 8 &&
    (confidence === "HIGH" || confidence === "MEDIUM")
  );
};

export const isStructuralChange = (card: HomeScannerInput) => {
  const trendScoreDelta = card.dayOverDay?.trendScoreDelta;
  const relativeVolume = currentRelativeVolume(card);

  return (
    (isFiniteNumber(trendScoreDelta) && Math.abs(trendScoreDelta) >= 10) ||
    hasEffectiveGammaSwitch(card) ||
    callWallMoveRatio(card) >= 0.02 ||
    (relativeVolume !== null && relativeVolume >= 1.5)
  );
};

export const matchesSignal = (card: HomeScannerInput, signal: HomeSignal) => {
  switch (signal) {
    case "ALL":
      return true;
    case "QUIET_STRENGTH":
      return isQuietStrength(card);
    case "STRUCTURAL_CHANGE":
      return isStructuralChange(card);
    default: {
      const exhaustiveSignal: never = signal;
      return exhaustiveSignal;
    }
  }
};

/**
 * A dimensionless, additive change score used by the CHANGE sort.
 *
 * One point represents one structural-change threshold: a valid gamma switch,
 * 10 trend-score points, a 2% call-wall move, or RVOL 0.5 above normal.
 */
export const primaryChangeScore = (card: HomeScannerInput) => {
  const trendScoreDelta = card.dayOverDay?.trendScoreDelta;
  const relativeVolume = currentRelativeVolume(card);

  const gammaScore = hasEffectiveGammaSwitch(card) ? 1 : 0;
  const trendScore = isFiniteNumber(trendScoreDelta)
    ? Math.abs(trendScoreDelta) / 10
    : 0;
  const callWallScore = callWallMoveRatio(card) / 0.02;
  const relativeVolumeScore =
    relativeVolume === null ? 0 : Math.max(0, (relativeVolume - 1) / 0.5);

  return gammaScore + trendScore + callWallScore + relativeVolumeScore;
};

const compareSymbols = (left: string, right: string) => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

export const sortCards = <Card extends HomeScannerInput>(
  cards: readonly Card[],
  sort: HomeSort,
): Card[] =>
  [...cards].sort((left, right) => {
    const leftScore =
      sort === "CHANGE"
        ? primaryChangeScore(left)
        : isFiniteNumber(left.trendScore)
          ? left.trendScore
          : Number.NEGATIVE_INFINITY;
    const rightScore =
      sort === "CHANGE"
        ? primaryChangeScore(right)
        : isFiniteNumber(right.trendScore)
          ? right.trendScore
          : Number.NEGATIVE_INFINITY;

    if (leftScore !== rightScore) return rightScore - leftScore;
    return compareSymbols(left.symbol, right.symbol);
  });
