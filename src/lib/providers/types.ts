import type { SupportedSymbol } from "@/lib/stocks";

export type { SupportedSymbol } from "@/lib/stocks";
export type OptionSide = "CALL" | "PUT";

export interface StockDailyRecord {
  symbol: SupportedSymbol;
  tradeDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjustedClose: number | null;
  volume: number | null;
  provider: "ONCLICKMEDIA" | "LONGBRIDGE";
}

export interface OptionContractRecord {
  symbol: SupportedSymbol;
  tradeDate: string;
  expiration: string;
  optionType: OptionSide;
  strike: number;
  contractSymbol: string | null;
  contractMultiplier: number;
  bid: number | null;
  ask: number | null;
  last: number | null;
  volume: number | null;
  openInterest: number | null;
  impliedVolatility: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  provider: "ONCLICKMEDIA";
}

export interface ProviderResult<T> {
  records: T[];
  warnings: string[];
}
