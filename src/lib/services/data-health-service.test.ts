import { describe, expect, it } from "vitest";
import { businessDaysAfter } from "./data-health-service";

describe("businessDaysAfter", () => {
  it("does not treat a weekend as stale trading data", () => {
    expect(businessDaysAfter("2026-08-28", "2026-08-30")).toBe(0);
  });

  it("counts weekdays after the latest market date", () => {
    expect(businessDaysAfter("2026-08-28", "2026-09-01")).toBe(2);
  });
});
