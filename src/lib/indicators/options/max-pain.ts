import type { OptionContractRecord } from "@/lib/providers/types";

export function maxPain(chain: OptionContractRecord[], close: number): number | null {
  const strikes = [...new Set(chain.map((item) => item.strike))];
  if (!strikes.length) return null;
  const pain = strikes.map((settlement) => ({
    strike: settlement,
    total: chain.reduce((sum, contract) => {
      const oi = contract.openInterest !== null && contract.openInterest >= 0 ? contract.openInterest : 0;
      if (contract.optionType === "CALL" && contract.strike < settlement) {
        return sum + (settlement - contract.strike) * oi * contract.contractMultiplier;
      }
      if (contract.optionType === "PUT" && contract.strike > settlement) {
        return sum + (contract.strike - settlement) * oi * contract.contractMultiplier;
      }
      return sum;
    }, 0),
  }));
  pain.sort((a, b) => a.total - b.total || Math.abs(a.strike - close) - Math.abs(b.strike - close));
  return pain[0].strike;
}
