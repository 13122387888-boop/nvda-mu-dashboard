import type { OptionContractRecord } from "@/lib/providers/types";

export function contractPrice(contract: OptionContractRecord): number | null {
  if (contract.bid !== null && contract.ask !== null && contract.bid >= 0 && contract.ask > 0 && contract.ask >= contract.bid) {
    return (contract.bid + contract.ask) / 2;
  }
  return contract.last !== null && contract.last >= 0 ? contract.last : null;
}

export function expectedMove(chain: OptionContractRecord[], close: number) {
  const strikes = [...new Set(chain.map((contract) => contract.strike))].sort(
    (a, b) => Math.abs(a - close) - Math.abs(b - close) || a - b,
  );
  for (const strike of strikes) {
    const call = chain.find((contract) => contract.strike === strike && contract.optionType === "CALL");
    const put = chain.find((contract) => contract.strike === strike && contract.optionType === "PUT");
    if (!call || !put) continue;
    const callPrice = contractPrice(call);
    const putPrice = contractPrice(put);
    if (callPrice === null || putPrice === null) continue;
    const move = callPrice + putPrice;
    return {
      expectedMove: move,
      expectedMovePct: close > 0 ? move / close : null,
      expectedUpper: close + move,
      expectedLower: close - move,
    };
  }
  return { expectedMove: null, expectedMovePct: null, expectedUpper: null, expectedLower: null };
}
