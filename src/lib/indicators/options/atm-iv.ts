import type { OptionContractRecord } from "@/lib/providers/types";

export function atmIv(chain: OptionContractRecord[], close: number): number | null {
  const strike = [...new Set(chain.map((item) => item.strike))].sort(
    (a, b) => Math.abs(a - close) - Math.abs(b - close) || a - b,
  )[0];
  if (strike === undefined) return null;
  const values = chain
    .filter((item) => item.strike === strike && item.impliedVolatility !== null && item.impliedVolatility >= 0)
    .map((item) => item.impliedVolatility!);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
