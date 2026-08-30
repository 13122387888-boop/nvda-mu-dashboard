import type { OptionContractRecord, StockDailyRecord, SupportedSymbol } from "@/lib/providers/types";

export type DataQualityLevel = "GOOD" | "LIMITED" | "FAILED";

export type UpstreamOptionCoverage = {
  returned: number;
  available: number;
  ratio: number;
};

export type StockDataQuality = {
  level: DataQualityLevel;
  reasons: string[];
  stats: {
    recordCount: number;
    latestDate: string | null;
  };
};

export type OptionDataQuality = {
  level: DataQualityLevel;
  reasons: string[];
  stats: {
    tradeDate: string | null;
    recordCount: number;
    expirationCount: number;
    strikeCount: number;
    callCount: number;
    putCount: number;
    oiCoveragePct: number;
    ivCoveragePct: number;
    gammaCoveragePct: number;
    upstreamCoverage: UpstreamOptionCoverage | null;
  };
};

export type OptionSnapshotShape = {
  recordCount: number;
  expirationCount: number;
};

const coveragePercent = (covered: number, total: number) => total ? Math.round(covered / total * 1_000) / 10 : 0;

export function optionSnapshotRegression(
  current: OptionSnapshotShape,
  incoming: OptionSnapshotShape,
  minimumRetentionRatio = 0.7,
): string | null {
  if (current.recordCount <= 0) return null;
  if (incoming.recordCount < current.recordCount * minimumRetentionRatio) {
    return `incoming option snapshot has ${incoming.recordCount} rows versus ${current.recordCount} stored rows`;
  }
  if (current.expirationCount > 0 && incoming.expirationCount < current.expirationCount * minimumRetentionRatio) {
    return `incoming option snapshot has ${incoming.expirationCount} expirations versus ${current.expirationCount} stored expirations`;
  }
  return null;
}

export function parseOptionCoverageWarnings(warnings: string[]): UpstreamOptionCoverage | null {
  for (const warning of warnings) {
    const match = warning.match(/only\s+([\d,]+)\s+strikes?\s+out of\s+([\d,]+)\s+strikes?/i);
    if (!match) continue;
    const returned = Number(match[1].replaceAll(",", ""));
    const available = Number(match[2].replaceAll(",", ""));
    if (!Number.isFinite(returned) || !Number.isFinite(available) || returned < 0 || available <= 0) continue;
    return { returned, available, ratio: returned / available };
  }
  return null;
}

export function assessStockDataQuality(
  records: StockDailyRecord[],
  options: { expectedSymbol?: SupportedSymbol; expectedLatestDate?: string | null } = {},
): StockDataQuality {
  const reasons: string[] = [];
  if (!records.length) {
    return { level: "FAILED", reasons: ["No stock records were returned"], stats: { recordCount: 0, latestDate: null } };
  }

  const ordered = [...records].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  const latestDate = ordered.at(-1)?.tradeDate ?? null;
  const symbols = new Set(records.map((record) => record.symbol));
  const dates = new Set<string>();
  let invalidPriceRows = 0;
  let invalidVolumeRows = 0;
  let duplicateDates = 0;

  for (const record of records) {
    if (dates.has(record.tradeDate)) duplicateDates += 1;
    dates.add(record.tradeDate);
    const prices = [record.open, record.high, record.low, record.close];
    const validPrices = prices.every((value) => Number.isFinite(value) && value > 0)
      && record.high >= Math.max(record.open, record.close, record.low)
      && record.low <= Math.min(record.open, record.close, record.high);
    if (!validPrices) invalidPriceRows += 1;
    if (record.volume !== null && (!Number.isFinite(record.volume) || record.volume < 0)) invalidVolumeRows += 1;
  }

  if (symbols.size !== 1 || (options.expectedSymbol && !symbols.has(options.expectedSymbol))) reasons.push("Stock records contain an unexpected symbol");
  if (duplicateDates) reasons.push(`${duplicateDates} duplicate stock dates were returned`);
  if (invalidPriceRows) reasons.push(`${invalidPriceRows} stock rows have invalid OHLC values`);
  if (invalidVolumeRows) reasons.push(`${invalidVolumeRows} stock rows have invalid volume`);
  if (options.expectedLatestDate && latestDate !== options.expectedLatestDate) reasons.push(`Latest stock date ${latestDate ?? "missing"} does not match provider date ${options.expectedLatestDate}`);

  return {
    level: reasons.length ? "FAILED" : "GOOD",
    reasons,
    stats: { recordCount: records.length, latestDate },
  };
}

export function assessOptionDataQuality(
  records: OptionContractRecord[],
  options: {
    expectedSymbol?: SupportedSymbol;
    warnings?: string[];
    sourceCoverage?: "FULL" | "LIMITED_NEAR_MONEY";
  } = {},
): OptionDataQuality {
  const emptyStats: OptionDataQuality["stats"] = {
    tradeDate: null,
    recordCount: 0,
    expirationCount: 0,
    strikeCount: 0,
    callCount: 0,
    putCount: 0,
    oiCoveragePct: 0,
    ivCoveragePct: 0,
    gammaCoveragePct: 0,
    upstreamCoverage: parseOptionCoverageWarnings(options.warnings ?? []),
  };
  if (!records.length) return { level: "FAILED", reasons: ["No option records were returned"], stats: emptyStats };

  const symbols = new Set(records.map((record) => record.symbol));
  const tradeDates = new Set(records.map((record) => record.tradeDate));
  const expirations = new Set(records.map((record) => record.expiration));
  const strikes = new Set(records.map((record) => record.strike));
  const keys = new Set<string>();
  let duplicateRows = 0;
  let invalidRows = 0;
  let oiCount = 0;
  let ivCount = 0;
  let gammaCount = 0;
  let callCount = 0;
  let putCount = 0;
  let futureContractCount = 0;
  let staleExpirationRows = 0;
  let invalidMarketRows = 0;

  for (const record of records) {
    const key = `${record.symbol}|${record.tradeDate}|${record.expiration}|${record.optionType}|${record.strike}`;
    if (keys.has(key)) duplicateRows += 1;
    keys.add(key);
    if (!Number.isFinite(record.strike) || record.strike <= 0 || !Number.isFinite(record.contractMultiplier) || record.contractMultiplier <= 0) invalidRows += 1;
    const quotes = [record.bid, record.ask, record.last];
    const invalidQuote = quotes.some((value) => value !== null && (!Number.isFinite(value) || value < 0))
      || (record.bid !== null && record.ask !== null && record.bid > record.ask);
    const invalidGreeks = (record.delta !== null && (!Number.isFinite(record.delta) || record.delta < -1 || record.delta > 1))
      || (record.gamma !== null && (!Number.isFinite(record.gamma) || record.gamma < 0))
      || (record.vega !== null && (!Number.isFinite(record.vega) || record.vega < 0));
    const invalidCounts = (record.volume !== null && (!Number.isFinite(record.volume) || record.volume < 0))
      || (record.openInterest !== null && (!Number.isFinite(record.openInterest) || record.openInterest < 0))
      || (record.impliedVolatility !== null && (!Number.isFinite(record.impliedVolatility) || record.impliedVolatility < 0));
    if (invalidQuote || invalidGreeks || invalidCounts) invalidMarketRows += 1;
    if (record.openInterest !== null && Number.isFinite(record.openInterest) && record.openInterest >= 0) oiCount += 1;
    if (record.impliedVolatility !== null && Number.isFinite(record.impliedVolatility) && record.impliedVolatility >= 0) ivCount += 1;
    if (record.gamma !== null && Number.isFinite(record.gamma)) gammaCount += 1;
    if (record.optionType === "CALL") callCount += 1;
    else putCount += 1;
    if (record.expiration > record.tradeDate) futureContractCount += 1;
    if (record.expiration < record.tradeDate) staleExpirationRows += 1;
  }

  const upstreamCoverage = parseOptionCoverageWarnings(options.warnings ?? []);
  const stats: OptionDataQuality["stats"] = {
    tradeDate: tradeDates.size === 1 ? records[0].tradeDate : null,
    recordCount: records.length,
    expirationCount: expirations.size,
    strikeCount: strikes.size,
    callCount,
    putCount,
    oiCoveragePct: coveragePercent(oiCount, records.length),
    ivCoveragePct: coveragePercent(ivCount, records.length),
    gammaCoveragePct: coveragePercent(gammaCount, records.length),
    upstreamCoverage,
  };

  const failures: string[] = [];
  if (symbols.size !== 1 || (options.expectedSymbol && !symbols.has(options.expectedSymbol))) failures.push("Option records contain an unexpected symbol");
  if (tradeDates.size !== 1) failures.push("Option records contain more than one trade date");
  if (!callCount || !putCount) failures.push("Option records do not contain both Call and Put contracts");
  if (!futureContractCount) failures.push("Option records do not contain a future expiration");
  if (duplicateRows) failures.push(`${duplicateRows} duplicate option rows were returned`);
  if (invalidRows) failures.push(`${invalidRows} option rows have an invalid strike or multiplier`);
  if (invalidMarketRows) failures.push(`${invalidMarketRows} option rows have invalid quotes, counts or Greeks`);
  if (staleExpirationRows) failures.push(`${staleExpirationRows} option rows expired before the trade date`);
  if (failures.length) return { level: "FAILED", reasons: failures, stats };

  const limitations: string[] = [];
  if (upstreamCoverage) limitations.push(`Upstream returned ${upstreamCoverage.returned} of ${upstreamCoverage.available} strikes`);
  else if (options.sourceCoverage === "LIMITED_NEAR_MONEY") limitations.push("Upstream provides a near-the-money subset rather than the full option chain");
  if (stats.oiCoveragePct < 90) limitations.push(`Open-interest coverage is ${stats.oiCoveragePct}%`);
  if (stats.ivCoveragePct < 70) limitations.push(`Implied-volatility coverage is ${stats.ivCoveragePct}%`);
  if (stats.gammaCoveragePct < 70) limitations.push(`Gamma coverage is ${stats.gammaCoveragePct}%`);

  return { level: limitations.length ? "LIMITED" : "GOOD", reasons: limitations, stats };
}
