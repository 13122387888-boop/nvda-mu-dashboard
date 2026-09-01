export type StockSyncObservation<Symbol extends string = string> = {
  symbol: Symbol;
  fetchedLatestDate: string | null;
  storedStockDate: string | null;
  storedMetricsDate: string | null;
};

export type StockSyncValidation = {
  tradeDate: string;
  symbolCount: number;
};

export function validateStockSyncObservations<Symbol extends string>(
  observations: StockSyncObservation<Symbol>[],
  expectedSymbols: readonly Symbol[],
): StockSyncValidation {
  if (!expectedSymbols.length) throw new Error("No stock symbols were selected for validation");

  const bySymbol = new Map<Symbol, StockSyncObservation<Symbol>>();
  for (const observation of observations) {
    if (bySymbol.has(observation.symbol)) throw new Error(`Duplicate stock sync result for ${observation.symbol}`);
    bySymbol.set(observation.symbol, observation);
  }

  const missing = expectedSymbols.filter((symbol) => !bySymbol.has(symbol));
  if (missing.length) throw new Error(`Missing stock sync results: ${missing.join(", ")}`);

  const fetchedDates = new Set(
    expectedSymbols
      .map((symbol) => bySymbol.get(symbol)?.fetchedLatestDate ?? null)
      .filter((date): date is string => date !== null),
  );
  const noFetchedDate = expectedSymbols.filter((symbol) => !bySymbol.get(symbol)?.fetchedLatestDate);
  if (noFetchedDate.length) throw new Error(`No Longbridge daily bar was returned for: ${noFetchedDate.join(", ")}`);
  if (fetchedDates.size !== 1) {
    const details = expectedSymbols.map((symbol) => `${symbol}=${bySymbol.get(symbol)?.fetchedLatestDate ?? "missing"}`);
    throw new Error(`Longbridge latest dates are not aligned: ${details.join(", ")}`);
  }

  const tradeDate = [...fetchedDates][0]!;
  const stockMismatches = expectedSymbols.filter((symbol) => bySymbol.get(symbol)?.storedStockDate !== tradeDate);
  if (stockMismatches.length) throw new Error(`Stored stock rows are not current for: ${stockMismatches.join(", ")}`);

  const metricMismatches = expectedSymbols.filter((symbol) => bySymbol.get(symbol)?.storedMetricsDate !== tradeDate);
  if (metricMismatches.length) throw new Error(`Stored stock metrics are not current for: ${metricMismatches.join(", ")}`);

  return { tradeDate, symbolCount: expectedSymbols.length };
}
