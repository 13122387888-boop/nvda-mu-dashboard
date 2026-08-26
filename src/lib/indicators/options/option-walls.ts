import type { OptionContractRecord, OptionSide } from "@/lib/providers/types";

export function optionWall(chain: OptionContractRecord[], side: OptionSide, close: number): number | null {
  const usable = chain.filter((item) => item.optionType === side && item.openInterest !== null && item.openInterest > 0);
  if (!usable.length) return null;
  usable.sort((a, b) => (b.openInterest ?? 0) - (a.openInterest ?? 0) || Math.abs(a.strike - close) - Math.abs(b.strike - close));
  return usable[0].strike;
}
