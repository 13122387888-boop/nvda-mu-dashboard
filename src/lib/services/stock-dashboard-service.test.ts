import { describe, expect, it } from "vitest";
import { buildStockDashboard } from "./stock-dashboard-service";
import type { StockDailyRecord } from "@/lib/providers/types";
function history(count: number): StockDailyRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    symbol: "NVDA",
    tradeDate: new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10),
    open: 100 + i,
    high: 102 + i,
    low: 99 + i,
    close: 101 + i,
    adjustedClose: 101 + i,
    volume: 1000 + i,
    provider: "LONGBRIDGE",
  }));
}
describe("Longbridge-only dashboard", () => {
  it("never combines legacy source rows into quotes, indicators or chart history", () => {
    const rows = history(220);
    const legacy = {
      ...rows.at(-1)!,
      tradeDate: "2026-10-22",
      close: 9999,
      adjustedClose: 9999,
      provider: "LEGACY",
    } as unknown as StockDailyRecord;
    const actual = buildStockDashboard("NVDA", [...rows, legacy])!;
    expect(actual.stockDate).toBe(rows.at(-1)!.tradeDate);
    expect(actual.quote.close).toBe(320);
    expect(actual.trend.ma200).toBe(220.5);
    expect(actual.priceHistory.at(-1)!.close).toBe(320);
    expect(actual).not.toHaveProperty("options");
    expect(buildStockDashboard("NVDA", [legacy])).toBeNull();
  });
  it("keeps long-term indicators unavailable for a newly listed security", () => {
    const actual = buildStockDashboard("NVDA", history(30))!;
    expect(actual.trend.ma200).toBeNull();
    expect(actual.trend.score).toBeNull();
    expect(actual.trend.historyCount).toBe(30);
    expect(actual.priceHistory.at(-1)!.bollingerMiddle).not.toBeNull();
  });
});
