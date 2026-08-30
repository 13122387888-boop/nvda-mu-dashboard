import { addDays, dateToYmd } from "@/lib/dates";
import { assessOptionDataQuality } from "@/lib/data-quality";
import { getPrisma } from "@/lib/db/prisma";
import { Prisma, type StockMetrics } from "@/generated/prisma/client";
import { unstable_cache } from "next/cache";
import { bollingerBandsSeries, summarizeBollingerBands, type BollingerBandsSummary } from "@/lib/indicators/bollinger-bands";
import { calculateGammaExposureProxy } from "@/lib/indicators/options/gamma-exposure";
import { calculateOptionMetrics } from "@/lib/indicators/options/option-metrics";
import { aggregateOptionWall } from "@/lib/indicators/options/option-walls";
import { calculateIvSkew } from "@/lib/indicators/options/iv-skew";
import { addWallPersistence, buildOptionResearchHistory, calculateIvPercentile, calculateIvTermStructure, calculateOiChange, calculateWallProfile } from "@/lib/indicators/options/option-research";
import { putCallOpenInterest } from "@/lib/indicators/options/put-call-ratio";
import { movingAverageSeries } from "@/lib/indicators/moving-average";
import { calculateStockMetrics, calculateTrendConfidence, calculateTrendScore, calculateTrendScoreBreakdown, classifyMarketStatus } from "@/lib/indicators/stock-metrics";
import { realizedVolatility } from "@/lib/indicators/realized-volatility";
import { latestRelativeVolume, relativeVolumeSeries } from "@/lib/indicators/relative-volume";
import { calculateVolumeProfile, type VolumeProfile } from "@/lib/indicators/volume-profile";
import { wilderRsi } from "@/lib/indicators/rsi";
import type { OptionContractRecord, StockDailyRecord, SupportedSymbol } from "@/lib/providers/types";
import { OnclickMediaProvider } from "@/lib/providers/onclickmedia/onclickmedia-provider";
import { STOCKS, SUPPORTED_SYMBOLS } from "@/lib/stocks";

export { isSupportedSymbol, STOCKS, SUPPORTED_SYMBOLS } from "@/lib/stocks";

export type OptionWindow = "ALL" | "7" | "30" | "50";

const OPTION_WINDOW_LIMITS: Record<OptionWindow, number | null> = {
  ALL: null,
  "7": 7,
  "30": 30,
  "50": 50,
};

const OPTION_WINDOW_LABELS: Record<OptionWindow, string> = {
  ALL: "全部到期日",
  "7": "7天内",
  "30": "30天内",
  "50": "50天内",
};

const numberOrNull = (value: { toString(): string } | null) => value === null ? null : Number(value);

const EMPTY_VOLUME_PROFILE: VolumeProfile = {
  status: "UNAVAILABLE", bins: [], pointOfControl: null, valueAreaHigh: null, valueAreaLow: null,
  sampleStart: null, sampleEnd: null, sessionCount: 0, barCount: 0, barSize: "1分钟",
};

const EMPTY_BOLLINGER: BollingerBandsSummary = {
  middle: null,
  upper: null,
  lower: null,
  percentB: null,
  bandwidth: null,
  bandwidthPercentile: null,
  state: "UNAVAILABLE",
  sampleSize: 0,
};

export type MaStructure = "BULLISH" | "BULLISH_PULLBACK" | "BEARISH" | "MIXED" | "UNAVAILABLE";

export function classifyMaStructure(input: {
  close: number;
  ma50: number | null;
  ma100: number | null;
  ma200: number | null;
}): MaStructure {
  const { close, ma50, ma100, ma200 } = input;
  if (
    !Number.isFinite(close)
    || close <= 0
    || ma50 === null
    || ma100 === null
    || ma200 === null
  ) return "UNAVAILABLE";

  if (ma50 > ma100 && ma100 > ma200) {
    return close > ma50 ? "BULLISH" : close >= ma100 ? "BULLISH_PULLBACK" : "MIXED";
  }
  if (close < ma50 && ma50 < ma100 && ma100 < ma200) return "BEARISH";
  return "MIXED";
}

async function loadVolumeProfile(symbol: SupportedSymbol, endDate: string) {
  try {
    const provider = new OnclickMediaProvider();
    const result = await provider.getStockIntradayHistory({ symbol, startDate: addDays(endDate, -35), endDate });
    return calculateVolumeProfile(result.records);
  } catch {
    return EMPTY_VOLUME_PROFILE;
  }
}

const getCachedVolumeProfile = unstable_cache(loadVolumeProfile, ["volume-profile-v1"], { revalidate: 21_600 });

type OptionDatabaseRow = {
  symbol: string;
  tradeDate: Date;
  expiration: Date;
  optionType: "CALL" | "PUT";
  strike: { toString(): string };
  contractSymbol: string | null;
  contractMultiplier: number;
  bid: { toString(): string } | null;
  ask: { toString(): string } | null;
  last: { toString(): string } | null;
  volume: bigint | null;
  openInterest: bigint | null;
  impliedVolatility: { toString(): string } | null;
  delta: { toString(): string } | null;
  gamma: { toString(): string } | null;
  theta: { toString(): string } | null;
  vega: { toString(): string } | null;
};

function toOptionRecord(row: OptionDatabaseRow): OptionContractRecord {
  return {
    symbol: row.symbol as SupportedSymbol,
    tradeDate: dateToYmd(row.tradeDate),
    expiration: dateToYmd(row.expiration),
    optionType: row.optionType,
    strike: Number(row.strike),
    contractSymbol: row.contractSymbol,
    contractMultiplier: row.contractMultiplier,
    bid: numberOrNull(row.bid),
    ask: numberOrNull(row.ask),
    last: numberOrNull(row.last),
    volume: row.volume === null ? null : Number(row.volume),
    openInterest: row.openInterest === null ? null : Number(row.openInterest),
    impliedVolatility: numberOrNull(row.impliedVolatility),
    delta: numberOrNull(row.delta),
    gamma: numberOrNull(row.gamma),
    theta: numberOrNull(row.theta),
    vega: numberOrNull(row.vega),
    provider: "ONCLICKMEDIA",
  };
}

function normalizeOptionWindow(value?: string | null): OptionWindow {
  return value === "7" || value === "30" || value === "50" ? value : "ALL";
}

function remainingDays(tradeDate: Date, expiration: Date) {
  return Math.ceil((expiration.getTime() - tradeDate.getTime()) / 86_400_000);
}

export type ExpectedRangeValidation = {
  lower: number | null;
  upper: number | null;
  state: "ABOVE" | "BELOW" | "NEAR_UPPER" | "NEAR_LOWER" | "INSIDE" | "UNAVAILABLE";
  boundaryDistancePct: number | null;
};

export function classifyExpectedRange(
  lower: number | null,
  upper: number | null,
  currentClose: number,
): ExpectedRangeValidation {
  if (lower === null || upper === null || !Number.isFinite(lower) || !Number.isFinite(upper) || lower >= upper || !Number.isFinite(currentClose) || currentClose <= 0) {
    return { lower, upper, state: "UNAVAILABLE", boundaryDistancePct: null };
  }

  let state: ExpectedRangeValidation["state"];
  let boundary: number;
  if (currentClose > upper) {
    state = "ABOVE";
    boundary = upper;
  } else if (currentClose < lower) {
    state = "BELOW";
    boundary = lower;
  } else {
    const position = (currentClose - lower) / (upper - lower);
    if (position <= 0.15) {
      state = "NEAR_LOWER";
      boundary = lower;
    } else if (position >= 0.85) {
      state = "NEAR_UPPER";
      boundary = upper;
    } else {
      state = "INSIDE";
      boundary = currentClose - lower <= upper - currentClose ? lower : upper;
    }
  }

  return {
    lower,
    upper,
    state,
    boundaryDistancePct: Math.abs(currentClose - boundary) / currentClose * 100,
  };
}

function calculateDayOverDayChange(input: {
  symbol: SupportedSymbol;
  currentTradeDate: Date;
  currentOptionsTradeDate: Date | null;
  previousOptionsTradeDate: Date | null;
  currentTrendScore: number | null;
  currentClose: number;
  currentOptionRows: OptionDatabaseRow[];
  previousOptionRows: OptionDatabaseRow[];
  currentStockHistory: StockDailyRecord[];
}) {
  const history = input.currentStockHistory.slice(-210);
  const previousStock = history.length > 1 ? calculateStockMetrics(history.slice(0, -1)) : null;
  const relativeVolume = latestRelativeVolume(history.map((row) => row.volume));
  const currentOptions = input.currentOptionRows.map(toOptionRecord);
  const previousOptions = input.previousOptionRows.map(toOptionRecord);
  const previousClose = previousStock?.close ?? null;
  const currentGamma = calculateGammaExposureProxy(currentOptions.map((row) => ({
    optionType: row.optionType,
    gamma: row.gamma,
    openInterest: row.openInterest,
    contractMultiplier: row.contractMultiplier,
  })), input.currentClose).regime;
  const previousGamma = previousClose === null ? "UNAVAILABLE" : calculateGammaExposureProxy(previousOptions.map((row) => ({
    optionType: row.optionType,
    gamma: row.gamma,
    openInterest: row.openInterest,
    contractMultiplier: row.contractMultiplier,
  })), previousClose).regime;
  const currentCallWall = aggregateOptionWall(currentOptions, "CALL", input.currentClose);
  const previousCallWall = previousClose === null ? null : aggregateOptionWall(previousOptions, "CALL", previousClose);
  const previousPricing = previousClose === null ? null : calculateOptionMetrics(previousOptions, previousClose);
  const expectedRange = classifyExpectedRange(
    previousPricing?.expectedLower ?? null,
    previousPricing?.expectedUpper ?? null,
    input.currentClose,
  );

  return {
    previousStockDate: previousStock?.tradeDate ?? null,
    previousOptionsDate: input.previousOptionsTradeDate ? dateToYmd(input.previousOptionsTradeDate) : null,
    trendScoreDelta: input.currentTrendScore === null || previousStock?.trendScore === null || previousStock?.trendScore === undefined
      ? null
      : input.currentTrendScore - previousStock.trendScore,
    gamma: { previous: previousGamma, current: currentGamma },
    callWall: {
      previous: previousCallWall,
      current: currentCallWall,
      delta: currentCallWall === null || previousCallWall === null ? null : currentCallWall - previousCallWall,
    },
    expectedRange,
    relativeVolume,
  };
}

async function loadDayOverDayChange(input: {
  symbol: SupportedSymbol;
  currentTradeDate: Date;
  currentOptionsTradeDate: Date | null;
  currentTrendScore: number | null;
  currentClose: number;
  currentOptionRows?: OptionDatabaseRow[];
  currentStockHistory?: StockDailyRecord[];
}) {
  const prisma = getPrisma();
  const history = input.currentStockHistory
    ?? (await prisma.stockDaily.findMany({
      where: { symbol: input.symbol, tradeDate: { lte: input.currentTradeDate } },
      orderBy: { tradeDate: "desc" },
      take: 210,
    })).reverse().map((row) => ({
      symbol: input.symbol,
      tradeDate: dateToYmd(row.tradeDate),
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      adjustedClose: numberOrNull(row.adjustedClose),
      volume: row.volume === null ? null : Number(row.volume),
      provider: row.provider === "LONGBRIDGE" ? "LONGBRIDGE" as const : "ONCLICKMEDIA" as const,
    }));
  const previousOptionDateRow = input.currentOptionsTradeDate
    ? await prisma.optionEod.findFirst({
        where: { symbol: input.symbol, tradeDate: { lt: input.currentOptionsTradeDate } },
        orderBy: { tradeDate: "desc" },
        select: { tradeDate: true },
      })
    : null;
  const [currentOptionRows, previousOptionRows] = await Promise.all([
    input.currentOptionRows
      ? Promise.resolve(input.currentOptionRows)
      : input.currentOptionsTradeDate
        ? prisma.optionEod.findMany({
            where: { symbol: input.symbol, tradeDate: input.currentOptionsTradeDate, expiration: { gt: input.currentOptionsTradeDate } },
          })
        : Promise.resolve([]),
    previousOptionDateRow
      ? prisma.optionEod.findMany({
          where: { symbol: input.symbol, tradeDate: previousOptionDateRow.tradeDate, expiration: { gt: previousOptionDateRow.tradeDate } },
        })
      : Promise.resolve([]),
  ]);
  return calculateDayOverDayChange({
    ...input,
    previousOptionsTradeDate: previousOptionDateRow?.tradeDate ?? null,
    currentOptionRows,
    previousOptionRows,
    currentStockHistory: history,
  });
}

function percentileRank(values: Array<number | null>, current: number | null, minimumSamples = 60) {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value)).slice(-252);
  if (current === null || !Number.isFinite(current) || valid.length < minimumSamples) {
    return { percentile: null, sampleSize: valid.length };
  }
  const atOrBelow = valid.filter((value) => value <= current).length;
  return { percentile: Math.round((atOrBelow / valid.length) * 100), sampleSize: valid.length };
}

export function ivPercentileLabel(input: { percentile: number | null; sampleSize: number }) {
  if (input.percentile === null) return `近${input.sampleSize}次·样本不足`;
  const position = input.percentile >= 70 ? "偏高" : input.percentile <= 30 ? "偏低" : "中位";
  return `近${input.sampleSize}次·${input.sampleSize < 20 ? "初步" : ""}${position}`;
}

function buildHistoricalPositions(closes: number[], current: { rsi14: number | null; rv20: number | null; ma50: number | null }) {
  const rsiSeries = closes.map((_, index) => wilderRsi(closes.slice(0, index + 1), 14));
  const rvSeries = closes.map((_, index) => realizedVolatility(closes.slice(0, index + 1), 20));
  const ma50Series = movingAverageSeries(closes, 50);
  const deviationSeries = closes.map((close, index) => ma50Series[index] === null ? null : (close / ma50Series[index]! - 1));
  const currentDeviation = current.ma50 === null || current.ma50 === 0 ? null : closes.at(-1)! / current.ma50 - 1;
  return {
    rsi14: { value: current.rsi14, ...percentileRank(rsiSeries, current.rsi14) },
    rv20: { value: current.rv20, ...percentileRank(rvSeries, current.rv20) },
    ma50Deviation: { value: currentDeviation, ...percentileRank(deviationSeries, currentDeviation) },
  };
}

type AttentionTone = "positive" | "negative" | "warning" | "neutral";

function percentDistance(value: number | null, close: number) {
  return value === null || close <= 0 ? null : Math.abs(value / close - 1) * 100;
}

export function stockAttention(input: {
  close: number;
  marketStatus: string;
  optionsDate: string | null;
  gammaRegime: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNAVAILABLE";
  callWall: number | null;
  putWall: number | null;
  dayOverDay: Awaited<ReturnType<typeof loadDayOverDayChange>> | null;
}): { label: string; detail: string; score: number; tone: AttentionTone } {
  const change = input.dayOverDay;
  const gammaChanged = change
    && change.gamma.previous !== "UNAVAILABLE"
    && change.gamma.current !== "UNAVAILABLE"
    && change.gamma.previous !== change.gamma.current;
  if (gammaChanged) {
    const labels = { POSITIVE: "正 Gamma", NEGATIVE: "负 Gamma", NEUTRAL: "Gamma 中性", UNAVAILABLE: "Gamma 暂无" } as const;
    const tone = change.gamma.current === "NEGATIVE" ? "negative" : change.gamma.current === "POSITIVE" ? "positive" : "warning";
    return {
      label: "Gamma 状态切换",
      detail: `${labels[change.gamma.previous]} → ${labels[change.gamma.current]}`,
      score: 100,
      tone,
    };
  }

  if (change?.trendScoreDelta !== null && change?.trendScoreDelta !== undefined && Math.abs(change.trendScoreDelta) >= 10) {
    const rising = change.trendScoreDelta > 0;
    return {
      label: rising ? "趋势分显著上升" : "趋势分显著下降",
      detail: `较昨日 ${rising ? "+" : ""}${change.trendScoreDelta} 分`,
      score: 90,
      tone: rising ? "positive" : "negative",
    };
  }

  if (change?.expectedRange.state === "ABOVE" || change?.expectedRange.state === "BELOW") {
    const above = change.expectedRange.state === "ABOVE";
    return {
      label: above ? "上破昨日预期上沿" : "下破昨日预期下沿",
      detail: change.expectedRange.boundaryDistancePct === null
        ? "当前收盘已越过昨日预期边界"
        : `越过边界约 ${change.expectedRange.boundaryDistancePct.toFixed(1)}%`,
      score: 80,
      tone: above ? "warning" : "negative",
    };
  }

  const callWallMovePct = change?.callWall.delta === null || change?.callWall.delta === undefined || input.close <= 0
    ? null
    : Math.abs(change.callWall.delta) / input.close * 100;
  if (callWallMovePct !== null && callWallMovePct >= 2) {
    const rising = change!.callWall.delta! > 0;
    return {
      label: rising ? "看涨墙显著上移" : "看涨墙显著下移",
      detail: `较昨日移动约收盘价的 ${callWallMovePct.toFixed(1)}%`,
      score: 70,
      tone: "warning",
    };
  }

  const relativeVolume = change?.relativeVolume.relativeVolume ?? null;
  if (relativeVolume !== null && relativeVolume >= 1.5) {
    return {
      label: "成交量明显放大",
      detail: `RVOL ${relativeVolume.toFixed(1)}×（相对20日均量）`,
      score: 60,
      tone: "warning",
    };
  }

  if (input.gammaRegime === "NEGATIVE") return { label: "负 Gamma 环境", detail: "短线波动可能更容易被放大", score: 50, tone: "negative" };

  const wallLevels = [
    { label: "接近看涨墙", value: input.callWall },
    { label: "接近看跌墙", value: input.putWall },
  ].map((item) => ({ ...item, distance: percentDistance(item.value, input.close) }))
    .filter((item): item is typeof item & { distance: number } => item.distance !== null)
    .sort((a, b) => a.distance - b.distance);
  if (wallLevels[0] && wallLevels[0].distance <= 3) {
    return { label: wallLevels[0].label, detail: `距离约 ${wallLevels[0].distance.toFixed(1)}%`, score: 40 - wallLevels[0].distance, tone: "warning" };
  }

  if (!input.optionsDate) return { label: "期权数据待补充", detail: "价格趋势可用，期权结构暂不可判断", score: 30, tone: "warning" };
  if (input.marketStatus === "STRONG_BULLISH") return { label: "趋势强势偏多", detail: "价格与均线结构保持强势", score: 25, tone: "positive" };
  if (input.marketStatus === "BEARISH") return { label: "趋势偏空", detail: "价格处于偏弱趋势结构", score: 25, tone: "negative" };
  return { label: "结构暂无明显异常", detail: "进入详情查看完整依据", score: 20, tone: "neutral" };
}

function buildStockCard(input: {
  symbol: SupportedSymbol;
  metrics: StockMetrics | null;
  stockHistoryRows: Array<{
    tradeDate: Date;
    close: number;
    volume: number | null;
    provider: string;
  }>;
  ivHistory: number[];
  gammaRegime: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNAVAILABLE";
}) {
  const { symbol, metrics } = input;
  const alignedStockHistoryRows = metrics
    ? input.stockHistoryRows.filter((row) => row.tradeDate <= metrics.tradeDate).slice(0, 271)
    : input.stockHistoryRows;
  const historyCount = alignedStockHistoryRows.length;
  if (!metrics) {
    return {
      symbol,
      name: STOCKS[symbol].name,
      shortName: STOCKS[symbol].shortName,
      accent: STOCKS[symbol].accent,
      assetType: STOCKS[symbol].assetType,
      close: null,
      dailyChangePct: null,
      trendScore: null,
      trendBreakdown: null,
      trendConfidence: calculateTrendConfidence({ ma50: null, ma100: null, ma200: null, historyCount }),
      marketStatus: "INSUFFICIENT_DATA" as const,
      gammaRegime: "UNAVAILABLE" as const,
      attention: { label: "等待首次同步", detail: "数据完成后自动生成观察理由", score: 100, tone: "warning" as const },
      dayOverDay: null,
      relativeVolume: null,
      rsi14: null,
      bollinger: { ...EMPTY_BOLLINGER },
      maStructure: "UNAVAILABLE" as const,
      ivPercentile: { percentile: null, sampleSize: 0, label: "近0次·样本不足" },
      dataDate: null,
    };
  }

  const close = Number(metrics.close);
  const optionsDate = metrics.optionsTradeDate ? dateToYmd(metrics.optionsTradeDate) : null;
  const stockHistory: StockDailyRecord[] = [...alignedStockHistoryRows].reverse().map((row) => ({
    symbol,
    tradeDate: dateToYmd(row.tradeDate),
    open: row.close,
    high: row.close,
    low: row.close,
    close: row.close,
    adjustedClose: row.close,
    volume: row.volume,
    provider: row.provider === "LONGBRIDGE" ? "LONGBRIDGE" as const : "ONCLICKMEDIA" as const,
  }));
  const closes = stockHistory.map((row) => row.adjustedClose ?? row.close);
  const ma50 = movingAverageSeries(closes, 50).at(-1) ?? null;
  const ma100 = movingAverageSeries(closes, 100).at(-1) ?? null;
  const ma200 = movingAverageSeries(closes, 200).at(-1) ?? null;
  const rsi14 = wilderRsi(closes, 14);
  const bollinger = summarizeBollingerBands(bollingerBandsSeries(closes, 20, 2));
  const maStructure = classifyMaStructure({ close, ma50, ma100, ma200 });
  const trendBreakdown = calculateTrendScoreBreakdown({ close, ma50, ma100, ma200, rsi14 });
  const trendScore = trendBreakdown?.score ?? null;
  const trendConfidence = calculateTrendConfidence({ ma50, ma100, ma200, historyCount });
  const marketStatus = classifyMarketStatus({ close, ma50, ma100, ma200, rsi14 });
  const ivRank = percentileRank(input.ivHistory, numberOrNull(metrics.atmIv), 1);
  const ivPercentile = { ...ivRank, label: ivPercentileLabel(ivRank) };
  const dayOverDay = calculateDayOverDayChange({
    symbol,
    currentTradeDate: metrics.tradeDate,
    currentOptionsTradeDate: metrics.optionsTradeDate,
    previousOptionsTradeDate: null,
    currentTrendScore: trendScore,
    currentClose: close,
    currentOptionRows: [],
    previousOptionRows: [],
    currentStockHistory: stockHistory,
  });
  const attention = stockAttention({
    close,
    marketStatus,
    optionsDate,
    gammaRegime: input.gammaRegime,
    callWall: numberOrNull(metrics.callWall),
    putWall: numberOrNull(metrics.putWall),
    dayOverDay,
  });

  return {
    symbol,
    name: STOCKS[symbol].name,
    shortName: STOCKS[symbol].shortName,
    accent: STOCKS[symbol].accent,
    assetType: STOCKS[symbol].assetType,
    close,
    dailyChangePct: numberOrNull(metrics.dailyChangePct),
    trendScore,
    trendBreakdown,
    trendConfidence,
    marketStatus,
    gammaRegime: input.gammaRegime,
    attention,
    dayOverDay,
    relativeVolume: dayOverDay.relativeVolume.relativeVolume,
    rsi14,
    bollinger,
    maStructure,
    ivPercentile,
    dataDate: dateToYmd(metrics.tradeDate),
  };
}

async function loadStockCards() {
  const prisma = getPrisma();
  const metricsRows = await prisma.stockMetrics.findMany({
    where: { symbol: { in: SUPPORTED_SYMBOLS } },
    orderBy: [{ symbol: "asc" }, { tradeDate: "desc" }],
  });
  const stockRows = await prisma.$queryRaw<Array<{
    symbol: string;
    tradeDate: Date;
    close: number;
    volume: number | null;
    provider: string;
  }>>`
    WITH ranked_history AS (
      SELECT symbol, trade_date,
        COALESCE(adjusted_close, close)::float8 AS close,
        volume::float8 AS volume,
        provider,
        ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY trade_date DESC) AS row_number
      FROM stock_daily
      WHERE symbol IN (${Prisma.join(SUPPORTED_SYMBOLS)})
    )
    SELECT symbol, trade_date AS "tradeDate", close, volume, provider
    FROM ranked_history
    WHERE row_number <= 271
    ORDER BY symbol ASC, trade_date DESC
  `;
  const gammaRows = await prisma.$queryRaw<Array<{ symbol: string; callGamma: number; putGamma: number }>>`
    WITH latest_metrics AS (
      SELECT DISTINCT ON (symbol) symbol, options_trade_date
      FROM stock_metrics
      WHERE symbol IN (${Prisma.join(SUPPORTED_SYMBOLS)}) AND options_trade_date IS NOT NULL
      ORDER BY symbol, trade_date DESC
    )
    SELECT options.symbol,
      SUM(CASE WHEN options.option_type = 'CALL'
        THEN options.gamma * options.open_interest * options.contract_multiplier ELSE 0 END)::float8 AS "callGamma",
      SUM(CASE WHEN options.option_type = 'PUT'
        THEN options.gamma * options.open_interest * options.contract_multiplier ELSE 0 END)::float8 AS "putGamma"
    FROM option_eod options
    JOIN latest_metrics metrics ON metrics.symbol = options.symbol
      AND metrics.options_trade_date = options.trade_date
    WHERE options.expiration > options.trade_date
      AND options.gamma > 0
      AND options.open_interest > 0
      AND options.contract_multiplier > 0
    GROUP BY options.symbol
  `;
  const metricsBySymbol = new Map<SupportedSymbol, StockMetrics>();
  for (const row of metricsRows) {
    const symbol = row.symbol as SupportedSymbol;
    if (!metricsBySymbol.has(symbol)) metricsBySymbol.set(symbol, row);
  }
  const stockRowsBySymbol = new Map<SupportedSymbol, (typeof stockRows)[number][]>();
  for (const row of stockRows) {
    const symbol = row.symbol as SupportedSymbol;
    const rows = stockRowsBySymbol.get(symbol) ?? [];
    rows.push(row);
    stockRowsBySymbol.set(symbol, rows);
  }
  const gammaRegimeBySymbol = new Map<SupportedSymbol, "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNAVAILABLE">();
  for (const row of gammaRows) {
    gammaRegimeBySymbol.set(row.symbol as SupportedSymbol, calculateGammaExposureProxy([
      { optionType: "CALL", gamma: Number(row.callGamma), openInterest: 1, contractMultiplier: 1 },
      { optionType: "PUT", gamma: Number(row.putGamma), openInterest: 1, contractMultiplier: 1 },
    ], 1).regime);
  }
  const ivHistoryBySymbol = new Map<SupportedSymbol, number[]>();
  for (const row of metricsRows) {
    if (row.atmIv === null) continue;
    const symbol = row.symbol as SupportedSymbol;
    const values = ivHistoryBySymbol.get(symbol) ?? [];
    values.unshift(Number(row.atmIv));
    ivHistoryBySymbol.set(symbol, values);
  }

  return SUPPORTED_SYMBOLS.map((symbol) => {
    const metrics = metricsBySymbol.get(symbol) ?? null;
    return buildStockCard({
      symbol,
      metrics,
      stockHistoryRows: stockRowsBySymbol.get(symbol) ?? [],
      ivHistory: ivHistoryBySymbol.get(symbol) ?? [],
      gammaRegime: gammaRegimeBySymbol.get(symbol) ?? "UNAVAILABLE",
    });
  });
}

const getCachedStockCards = unstable_cache(loadStockCards, ["stock-cards-v19"], { revalidate: 300, tags: ["stock-dashboard"] });

export async function getStockCards() {
  return getCachedStockCards();
}

async function loadStockDashboardBundle(symbol: SupportedSymbol) {
  const prisma = getPrisma();
  const metrics = await prisma.stockMetrics.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" } });
  if (!metrics) return null;

  const chartStartDate = addDays(dateToYmd(metrics.tradeDate), -190);
  const calculationStartDate = addDays(dateToYmd(metrics.tradeDate), -450);
  const [calculationHistory, allOptionRows, optionDateGroups, volumeProfile, latestSyncRun] = await Promise.all([
    prisma.stockDaily.findMany({
      where: { symbol, tradeDate: { gte: new Date(`${calculationStartDate}T00:00:00.000Z`), lte: metrics.tradeDate } },
      orderBy: { tradeDate: "asc" },
    }),
    metrics.optionsTradeDate
      ? prisma.optionEod.findMany({
          where: { symbol, tradeDate: metrics.optionsTradeDate, expiration: { gt: metrics.optionsTradeDate } },
          orderBy: [{ expiration: "asc" }, { strike: "asc" }],
        })
      : Promise.resolve([]),
    prisma.optionEod.groupBy({
      by: ["tradeDate"],
      where: { symbol },
      orderBy: { tradeDate: "desc" },
      take: 16,
    }),
    getCachedVolumeProfile(symbol, dateToYmd(metrics.tradeDate)),
    prisma.syncRun.findFirst({ orderBy: { startedAt: "desc" }, select: { errorMessage: true } }),
  ]);
  const optionHistoryDates = optionDateGroups.map((row) => row.tradeDate);
  const optionHistoryRows = optionHistoryDates.length
    ? await prisma.optionEod.findMany({
        where: { symbol, tradeDate: { in: optionHistoryDates } },
        orderBy: [{ tradeDate: "asc" }, { expiration: "asc" }, { strike: "asc" }],
      })
    : [];
  const closes = calculationHistory.map((row) => Number(row.adjustedClose ?? row.close));
  const stockResearchHistory: StockDailyRecord[] = calculationHistory.map((row) => ({
    symbol,
    tradeDate: dateToYmd(row.tradeDate),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    adjustedClose: numberOrNull(row.adjustedClose),
    volume: row.volume === null ? null : Number(row.volume),
    provider: row.provider === "LONGBRIDGE" ? "LONGBRIDGE" as const : "ONCLICKMEDIA" as const,
  }));
  const ma50 = movingAverageSeries(closes, 50);
  const ma100 = movingAverageSeries(closes, 100);
  const ma200 = movingAverageSeries(closes, 200);
  const rsi14Series = closes.map((_, index) => wilderRsi(closes.slice(0, index + 1), 14));
  const bollingerSeries = bollingerBandsSeries(closes, 20, 2);
  const volumeSeries = relativeVolumeSeries(calculationHistory.map((row) => row.volume === null ? null : Number(row.volume)));
  const close = Number(metrics.close);
  const currentRsi14 = rsi14Series.at(-1) ?? null;
  const currentRv20 = numberOrNull(metrics.rv20);
  const currentMa50 = ma50.at(-1) ?? null;
  const currentMa100 = ma100.at(-1) ?? null;
  const currentMa200 = ma200.at(-1) ?? null;
  const currentBollinger = summarizeBollingerBands(bollingerSeries);
  const trendScore = calculateTrendScore({ close, ma50: currentMa50, ma100: currentMa100, ma200: currentMa200, rsi14: currentRsi14 });
  const marketStatus = classifyMarketStatus({ close, ma50: currentMa50, ma100: currentMa100, ma200: currentMa200, rsi14: currentRsi14 });
  const dayOverDay = await loadDayOverDayChange({
    symbol,
    currentTradeDate: metrics.tradeDate,
    currentOptionsTradeDate: metrics.optionsTradeDate,
    currentTrendScore: trendScore,
    currentClose: close,
    currentOptionRows: allOptionRows,
    currentStockHistory: stockResearchHistory,
  });
  const trendConfidence = calculateTrendConfidence({ ma50: currentMa50, ma100: currentMa100, ma200: currentMa200, historyCount: calculationHistory.length });
  const historicalPositions = buildHistoricalPositions(closes, { rsi14: currentRsi14, rv20: currentRv20, ma50: currentMa50 });
  const optionWindows = Object.keys(OPTION_WINDOW_LIMITS) as OptionWindow[];
  const optionWindowCounts = Object.fromEntries(optionWindows.map((window) => {
    const limit = OPTION_WINDOW_LIMITS[window];
    const count = limit === null || !metrics.optionsTradeDate
      ? allOptionRows.length
      : allOptionRows.filter((row) => remainingDays(metrics.optionsTradeDate!, row.expiration) <= limit).length;
    return [window, count];
  })) as Record<OptionWindow, number>;
  const priceHistory = calculationHistory.map((row, index) => {
    const rawClose = Number(row.close);
    const adjustedClose = numberOrNull(row.adjustedClose);
    const adjustmentFactor = adjustedClose !== null && rawClose > 0 ? adjustedClose / rawClose : 1;
    return {
      date: dateToYmd(row.tradeDate),
      open: Number(row.open) * adjustmentFactor,
      high: Number(row.high) * adjustmentFactor,
      low: Number(row.low) * adjustmentFactor,
      close: adjustedClose ?? rawClose,
      ma50: ma50[index],
      ma100: ma100[index],
      ma200: ma200[index],
      rsi14: rsi14Series[index],
      bollingerMiddle: bollingerSeries[index].middle,
      bollingerUpper: bollingerSeries[index].upper,
      bollingerLower: bollingerSeries[index].lower,
      bollingerPercentB: bollingerSeries[index].percentB,
      bollingerBandwidth: bollingerSeries[index].bandwidth,
      volume: volumeSeries[index].volume,
      volumeAverage20: volumeSeries[index].averageVolume,
      relativeVolume: volumeSeries[index].relativeVolume,
    };
  }).filter((point) => point.date >= chartStartDate);
  const optionSnapshots = optionHistoryDates
    .map((tradeDate) => ({
      tradeDate: dateToYmd(tradeDate),
      records: optionHistoryRows.filter((row) => row.tradeDate.getTime() === tradeDate.getTime()).map(toOptionRecord),
    }))
    .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  const symbolSyncWarnings = (latestSyncRun?.errorMessage?.split("\n") ?? [])
    .filter((line) => line.startsWith(`${symbol}: `))
    .map((line) => line.slice(symbol.length + 2));
  const optionDataQuality = assessOptionDataQuality(allOptionRows.map(toOptionRecord), {
    expectedSymbol: symbol,
    warnings: symbolSyncWarnings,
    sourceCoverage: "LIMITED_NEAR_MONEY",
  });

  const dashboards = optionWindows.map((optionWindow) => {
    const optionWindowLimit = OPTION_WINDOW_LIMITS[optionWindow];
    const optionRows = optionWindowLimit === null || !metrics.optionsTradeDate
      ? allOptionRows
      : allOptionRows.filter((row) => remainingDays(metrics.optionsTradeDate!, row.expiration) <= optionWindowLimit);
    const optionRecords = optionRows.map(toOptionRecord);
    const previousSnapshot = optionSnapshots.filter((snapshot) => snapshot.tradeDate < (metrics.optionsTradeDate ? dateToYmd(metrics.optionsTradeDate) : "")).at(-1);
    const previousOptionRecords = (previousSnapshot?.records ?? []).filter((row) => {
      if (optionWindowLimit === null || !previousSnapshot) return true;
      return Math.ceil((new Date(`${row.expiration}T00:00:00.000Z`).getTime() - new Date(`${previousSnapshot.tradeDate}T00:00:00.000Z`).getTime()) / 86_400_000) <= optionWindowLimit;
    });
    const pricingMetrics = calculateOptionMetrics(optionRecords, close);
    const gammaExposure = calculateGammaExposureProxy(optionRows.map((row) => ({
      optionType: row.optionType,
      gamma: numberOrNull(row.gamma),
      openInterest: row.openInterest === null ? null : Number(row.openInterest),
      contractMultiplier: row.contractMultiplier,
    })), close);
    const oi = new Map<number, { strike: number; callOi: number; putOi: number }>();
    for (const row of optionRows) {
      const strike = Number(row.strike);
      if (strike < close * 0.75 || strike > close * 1.25) continue;
      const point = oi.get(strike) ?? { strike, callOi: 0, putOi: 0 };
      const value = row.openInterest === null ? 0 : Number(row.openInterest);
      if (row.optionType === "CALL") point.callOi += value;
      else point.putOi += value;
      oi.set(strike, point);
    }
    const oiChange = calculateOiChange(optionRecords, previousOptionRecords, close);
    const optionResearchHistory = buildOptionResearchHistory(optionSnapshots.map((snapshot) => ({
      tradeDate: snapshot.tradeDate,
      records: optionWindowLimit === null
        ? snapshot.records
        : snapshot.records.filter((row) => Math.ceil((new Date(`${row.expiration}T00:00:00.000Z`).getTime() - new Date(`${snapshot.tradeDate}T00:00:00.000Z`).getTime()) / 86_400_000) <= optionWindowLimit),
    })), stockResearchHistory);
    const wallProfiles = {
      call: addWallPersistence(calculateWallProfile(optionRecords, "CALL", close), optionResearchHistory.points, "callWall"),
      put: addWallPersistence(calculateWallProfile(optionRecords, "PUT", close), optionResearchHistory.points, "putWall"),
    };
    const ivTermStructure = calculateIvTermStructure(optionRecords, close);
    const ivPercentile = calculateIvPercentile(optionResearchHistory.points, pricingMetrics.atmIv);
    const ivSkew = calculateIvSkew(optionRecords, close);

    const dashboard = {
      symbol,
      name: STOCKS[symbol].name,
      accent: STOCKS[symbol].accent,
      assetType: STOCKS[symbol].assetType,
      stockDate: dateToYmd(metrics.tradeDate),
      stockProviders: [...new Set(calculationHistory.map((row) => row.provider))].sort(),
      optionsSnapshotDate: metrics.optionsTradeDate ? dateToYmd(metrics.optionsTradeDate) : null,
      optionsDate: optionRows.length && metrics.optionsTradeDate ? dateToYmd(metrics.optionsTradeDate) : null,
      optionsExpiration: pricingMetrics.optionsExpiration,
      optionWindow,
      optionWindowLabel: OPTION_WINDOW_LABELS[optionWindow],
      optionWindowCounts,
      quote: {
        close,
        dailyChange: numberOrNull(metrics.dailyChange),
        dailyChangePct: numberOrNull(metrics.dailyChangePct),
        marketStatus,
      },
      trend: {
        ma50: currentMa50,
        ma100: currentMa100,
        ma200: currentMa200,
        rsi14: currentRsi14,
        bollinger: currentBollinger,
        rv20: currentRv20,
        relativeVolume: volumeSeries.at(-1)?.relativeVolume ?? null,
        averageVolume20: volumeSeries.at(-1)?.averageVolume ?? null,
        score: trendScore,
        confidence: trendConfidence,
        historyCount: calculationHistory.length,
      },
      options: {
        expectedMove: pricingMetrics.expectedMove,
        expectedMovePct: pricingMetrics.expectedMovePct,
        expectedUpper: pricingMetrics.expectedUpper,
        expectedLower: pricingMetrics.expectedLower,
        putCallOi: putCallOpenInterest(optionRecords),
        maxPain: pricingMetrics.maxPain,
        callWall: aggregateOptionWall(optionRecords, "CALL", close),
        putWall: aggregateOptionWall(optionRecords, "PUT", close),
        atmIv: pricingMetrics.atmIv,
        ivPercentile,
        ivTermStructure,
        ivSkew,
        wallProfiles,
        gammaExposure,
      },
      historicalPositions,
      volumeProfile,
      optionResearchHistory,
      dataQuality: { options: optionDataQuality },
      dayOverDay,
      priceHistory,
      optionOpenInterest: [...oi.values()].sort((a, b) => a.strike - b.strike),
      optionOpenInterestChange: oiChange,
    };
    return [optionWindow, dashboard] as const;
  });

  return Object.fromEntries(dashboards) as Record<OptionWindow, (typeof dashboards)[number][1]>;
}

const getCachedStockDashboardBundle = unstable_cache(
  loadStockDashboardBundle,
  ["stock-dashboard-bundle-v17"],
  { revalidate: 300, tags: ["stock-dashboard"] },
);

export async function getStockDashboard(symbol: SupportedSymbol, requestedWindow?: string | null) {
  const optionWindow = normalizeOptionWindow(requestedWindow);
  const bundle = await getCachedStockDashboardBundle(symbol);
  return bundle?.[optionWindow] ?? null;
}

export async function getDebugSnapshot() {
  const prisma = getPrisma();
  return Promise.all(SUPPORTED_SYMBOLS.map(async (symbol) => {
    const [stockCount, optionCount, latestStock, latestOption, latestMetrics, lastSync] = await Promise.all([
      prisma.stockDaily.count({ where: { symbol } }),
      prisma.optionEod.count({ where: { symbol } }),
      prisma.stockDaily.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" }, select: { tradeDate: true } }),
      prisma.optionEod.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" }, select: { tradeDate: true } }),
      prisma.stockMetrics.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" }, select: { tradeDate: true } }),
      prisma.syncRun.findFirst({ where: { symbols: { has: symbol } }, orderBy: { startedAt: "desc" } }),
    ]);
    return {
      symbol,
      latestStockDate: latestStock ? dateToYmd(latestStock.tradeDate) : null,
      stockRowCount: stockCount,
      latestOptionDate: latestOption ? dateToYmd(latestOption.tradeDate) : null,
      optionContractCount: optionCount,
      latestMetricsDate: latestMetrics ? dateToYmd(latestMetrics.tradeDate) : null,
      lastSyncStatus: lastSync?.status ?? null,
      lastSyncTime: lastSync?.completedAt?.toISOString() ?? lastSync?.startedAt.toISOString() ?? null,
    };
  }));
}
