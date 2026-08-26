import type { OptionContractRecord } from "@/lib/providers/types";

export function putCallOpenInterest(chain: OptionContractRecord[]): number | null {
  const validOi = (value: number | null) => (value !== null && value >= 0 ? value : 0);
  const callOi = chain.filter((item) => item.optionType === "CALL").reduce((sum, item) => sum + validOi(item.openInterest), 0);
  if (callOi === 0) return null;
  const putOi = chain.filter((item) => item.optionType === "PUT").reduce((sum, item) => sum + validOi(item.openInterest), 0);
  return putOi / callOi;
}
