import type { SupportedSymbol } from "@/lib/stocks";
export type { SupportedSymbol } from "@/lib/stocks";
export interface StockDailyRecord {
  symbol: SupportedSymbol;
  tradeDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjustedClose: number | null;
  volume: number | null;
  provider: "LONGBRIDGE";
}
