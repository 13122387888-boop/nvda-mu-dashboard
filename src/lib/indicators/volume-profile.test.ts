import { describe, expect, it } from "vitest";
import { calculateVolumeProfile } from "./volume-profile";

describe("calculateVolumeProfile", () => {
  it("finds the highest-volume price bin and a contiguous value area", () => {
    const profile = calculateVolumeProfile([
      { timestamp: "2026-08-25 09:30 AM", tradeDate: "2026-08-25", open: 99, high: 101, low: 99, close: 100, volume: 100 },
      { timestamp: "2026-08-25 09:31 AM", tradeDate: "2026-08-25", open: 100, high: 101, low: 100, close: 100.5, volume: 500 },
      { timestamp: "2026-08-25 09:32 AM", tradeDate: "2026-08-25", open: 102, high: 103, low: 102, close: 103, volume: 50 },
    ], 4);
    expect(profile.status).toBe("AVAILABLE");
    expect(profile.pointOfControl).not.toBeNull();
    expect(profile.bins.some((bin) => bin.inValueArea)).toBe(true);
    expect(profile.barCount).toBe(3);
  });
});
