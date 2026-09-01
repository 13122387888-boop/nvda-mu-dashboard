import { describe, expect, it } from "vitest";
import { businessDaysBetween, isRecentOptionSnapshot, optionSnapshotLagBusinessDays } from "./option-snapshot-freshness";

describe("option snapshot freshness", () => {
  it("treats Friday's option close as one weekday behind Monday's stock close", () => {
    expect(optionSnapshotLagBusinessDays("2026-08-31", "2026-08-28")).toBe(1);
    expect(isRecentOptionSnapshot("2026-08-31", "2026-08-28")).toBe(true);
  });

  it("accepts an aligned snapshot and rejects older or future snapshots", () => {
    expect(isRecentOptionSnapshot("2026-08-31", "2026-08-31")).toBe(true);
    expect(isRecentOptionSnapshot("2026-08-31", "2026-08-27")).toBe(false);
    expect(isRecentOptionSnapshot("2026-08-31", "2026-09-01")).toBe(false);
  });

  it("skips weekends when counting lag", () => {
    expect(businessDaysBetween("2026-08-28", "2026-08-30")).toBe(0);
  });
});
