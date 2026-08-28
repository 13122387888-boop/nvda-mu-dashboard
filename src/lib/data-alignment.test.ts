import { describe, expect, it } from "vitest";
import { getDataAlignment } from "@/lib/data-alignment";

describe("getDataAlignment", () => {
  it("recognizes matching stock and option snapshots", () => {
    expect(getDataAlignment("2026-08-27", "2026-08-27")).toEqual({ status: "ALIGNED" });
  });

  it("recognizes an older option snapshot", () => {
    expect(getDataAlignment("2026-08-27", "2026-08-26")).toEqual({ status: "MISMATCH", stockIsNewer: true });
  });

  it("recognizes an older stock snapshot", () => {
    expect(getDataAlignment("2026-08-26", "2026-08-27")).toEqual({ status: "MISMATCH", stockIsNewer: false });
  });

  it("keeps a missing source snapshot separate from an empty filtered window", () => {
    expect(getDataAlignment("2026-08-27", null)).toEqual({ status: "MISSING_OPTIONS" });
  });
});
