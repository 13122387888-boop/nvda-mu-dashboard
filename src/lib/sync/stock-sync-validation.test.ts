import { describe, expect, it } from "vitest";
import { validateStockSyncObservations } from "./stock-sync-validation";

const aligned = [
  { symbol: "NVDA", fetchedLatestDate: "2026-08-31", storedStockDate: "2026-08-31", storedMetricsDate: "2026-08-31" },
  { symbol: "MU", fetchedLatestDate: "2026-08-31", storedStockDate: "2026-08-31", storedMetricsDate: "2026-08-31" },
] as const;

describe("validateStockSyncObservations", () => {
  it("accepts a complete, aligned stock refresh", () => {
    expect(validateStockSyncObservations([...aligned], ["NVDA", "MU"])).toEqual({
      tradeDate: "2026-08-31",
      symbolCount: 2,
    });
  });

  it("rejects a symbol whose provider date is behind", () => {
    expect(() => validateStockSyncObservations([
      aligned[0],
      { ...aligned[1], fetchedLatestDate: "2026-08-28", storedStockDate: "2026-08-28", storedMetricsDate: "2026-08-28" },
    ], ["NVDA", "MU"])).toThrow("Longbridge latest dates are not aligned");
  });

  it("rejects missing metric recalculation", () => {
    expect(() => validateStockSyncObservations([
      aligned[0],
      { ...aligned[1], storedMetricsDate: "2026-08-28" },
    ], ["NVDA", "MU"])).toThrow("Stored stock metrics are not current for: MU");
  });

  it("rejects an incomplete symbol set", () => {
    expect(() => validateStockSyncObservations([aligned[0]], ["NVDA", "MU"])).toThrow("Missing stock sync results: MU");
  });
});
