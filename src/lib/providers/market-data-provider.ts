import type {
  OptionContractRecord,
  ProviderResult,
  StockDailyRecord,
  SupportedSymbol,
} from "./types";

export interface MarketDataProvider {
  getStockDailyHistory(params: {
    symbol: SupportedSymbol;
    startDate?: string;
    endDate?: string;
  }): Promise<ProviderResult<StockDailyRecord>>;

  getLatestOptionChain(params: {
    symbol: SupportedSymbol;
    tradeDate?: string;
  }): Promise<ProviderResult<OptionContractRecord>>;

  getLatestAvailableStockDate(symbol: SupportedSymbol): Promise<string | null>;
  getLatestAvailableOptionDate(symbol: SupportedSymbol): Promise<string | null>;
}
