export type GammaExposureInput = {
  optionType: "CALL" | "PUT";
  gamma: number | null;
  openInterest: number | null;
  contractMultiplier: number;
};

export type GammaRegime = "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNAVAILABLE";

export function calculateGammaExposureProxy(rows: GammaExposureInput[], spot: number) {
  if (!Number.isFinite(spot) || spot <= 0) {
    return { callGamma: 0, putGamma: 0, netGamma: 0, regime: "UNAVAILABLE" as GammaRegime };
  }

  let callGamma = 0;
  let putGamma = 0;

  for (const row of rows) {
    const gamma = row.gamma ?? 0;
    const openInterest = row.openInterest ?? 0;
    if (!Number.isFinite(gamma) || !Number.isFinite(openInterest) || gamma <= 0 || openInterest <= 0 || row.contractMultiplier <= 0) continue;

    // Approximate dollar delta change for a 1% move in the underlying.
    const exposure = gamma * openInterest * row.contractMultiplier * spot * spot * 0.01;
    if (row.optionType === "CALL") callGamma += exposure;
    else putGamma += exposure;
  }

  const netGamma = callGamma - putGamma;
  const grossGamma = callGamma + putGamma;
  const neutralBand = grossGamma * 0.05;
  const regime: GammaRegime = grossGamma === 0
    ? "UNAVAILABLE"
    : Math.abs(netGamma) <= neutralBand
      ? "NEUTRAL"
      : netGamma > 0
        ? "POSITIVE"
        : "NEGATIVE";

  return { callGamma, putGamma, netGamma, regime };
}
