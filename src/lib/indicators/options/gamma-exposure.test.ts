import { describe, expect, it } from "vitest";
import { calculateGammaExposureProxy } from "./gamma-exposure";

describe("calculateGammaExposureProxy", () => {
  it("uses calls as positive exposure", () => {
    const result = calculateGammaExposureProxy([
      { optionType: "CALL", gamma: 0.02, openInterest: 1_000, contractMultiplier: 100 },
    ], 100);
    expect(result.callGamma).toBe(200_000);
    expect(result.netGamma).toBe(200_000);
    expect(result.regime).toBe("POSITIVE");
  });

  it("uses puts as negative exposure", () => {
    const result = calculateGammaExposureProxy([
      { optionType: "PUT", gamma: 0.03, openInterest: 500, contractMultiplier: 100 },
    ], 100);
    expect(result.putGamma).toBe(150_000);
    expect(result.netGamma).toBe(-150_000);
    expect(result.regime).toBe("NEGATIVE");
  });

  it("treats a net value inside five percent of gross exposure as neutral", () => {
    const result = calculateGammaExposureProxy([
      { optionType: "CALL", gamma: 0.02, openInterest: 1_000, contractMultiplier: 100 },
      { optionType: "PUT", gamma: 0.02, openInterest: 950, contractMultiplier: 100 },
    ], 100);
    expect(result.regime).toBe("NEUTRAL");
  });

  it("ignores missing or invalid contract data", () => {
    const result = calculateGammaExposureProxy([
      { optionType: "CALL", gamma: null, openInterest: 1_000, contractMultiplier: 100 },
      { optionType: "PUT", gamma: -0.01, openInterest: 1_000, contractMultiplier: 100 },
    ], 100);
    expect(result.regime).toBe("UNAVAILABLE");
  });
});
