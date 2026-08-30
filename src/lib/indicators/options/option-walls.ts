import type { OptionContractRecord, OptionSide } from "@/lib/providers/types";

export function optionWall(chain: OptionContractRecord[], side: OptionSide, close: number): number | null {
  const usable = chain.filter((item) => item.optionType === side && item.openInterest !== null && item.openInterest > 0);
  if (!usable.length) return null;
  usable.sort((a, b) => (b.openInterest ?? 0) - (a.openInterest ?? 0) || Math.abs(a.strike - close) - Math.abs(b.strike - close));
  return usable[0].strike;
}

export function aggregateOptionWall(chain: OptionContractRecord[], side: OptionSide, close: number): number | null {
  const byStrike = new Map<number, number>();
  for (const contract of chain) {
    if (contract.optionType !== side || contract.openInterest === null || contract.openInterest <= 0) continue;
    byStrike.set(contract.strike, (byStrike.get(contract.strike) ?? 0) + contract.openInterest);
  }
  return [...byStrike.entries()]
    .sort((a, b) => b[1] - a[1] || Math.abs(a[0] - close) - Math.abs(b[0] - close))[0]?.[0] ?? null;
}
