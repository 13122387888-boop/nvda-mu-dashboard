import type { OptionContractRecord } from "@/lib/providers/types";
import { atmIv } from "./atm-iv";
import { expectedMove } from "./expected-move";
import { maxPain } from "./max-pain";
import { optionWall } from "./option-walls";
import { putCallOpenInterest } from "./put-call-ratio";

export function nearestExpirationChain(chain: OptionContractRecord[]) {
  if (!chain.length) return { expiration: null, contracts: [] as OptionContractRecord[] };
  const tradeDate = [...chain].sort((a, b) => b.tradeDate.localeCompare(a.tradeDate))[0].tradeDate;
  const expiration = [...new Set(chain.map((item) => item.expiration))]
    .filter((date) => date > tradeDate)
    .sort()[0] ?? null;
  return {
    expiration,
    contracts: expiration ? chain.filter((item) => item.tradeDate === tradeDate && item.expiration === expiration) : [],
  };
}

export function calculateOptionMetrics(chain: OptionContractRecord[], close: number) {
  const selected = nearestExpirationChain(chain);
  if (!selected.expiration || !selected.contracts.length) {
    return {
      optionsTradeDate: null,
      optionsExpiration: null,
      ...expectedMove([], close),
      putCallOi: null,
      maxPain: null,
      callWall: null,
      putWall: null,
      atmIv: null,
    };
  }
  return {
    optionsTradeDate: selected.contracts[0].tradeDate,
    optionsExpiration: selected.expiration,
    ...expectedMove(selected.contracts, close),
    putCallOi: putCallOpenInterest(selected.contracts),
    maxPain: maxPain(selected.contracts, close),
    callWall: optionWall(selected.contracts, "CALL", close),
    putWall: optionWall(selected.contracts, "PUT", close),
    atmIv: atmIv(selected.contracts, close),
  };
}
