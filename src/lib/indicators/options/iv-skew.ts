import type { OptionContractRecord } from "@/lib/providers/types";

export type IvSkewPoint = {
  strike: number;
  moneyness: number;
  callIv: number | null;
  putIv: number | null;
};

export type IvSkewResult = {
  status: "AVAILABLE" | "INSUFFICIENT";
  expiration: string | null;
  daysToExpiration: number | null;
  call25Iv: number | null;
  put25Iv: number | null;
  call25Strike: number | null;
  put25Strike: number | null;
  riskReversalVolPoints: number | null;
  label: string;
  reason: string;
  points: IvSkewPoint[];
};

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function daysBetween(start: string, end: string) {
  return Math.ceil((new Date(`${end}T00:00:00.000Z`).getTime() - new Date(`${start}T00:00:00.000Z`).getTime()) / 86_400_000);
}

export function calculateIvSkew(chain: OptionContractRecord[], close: number): IvSkewResult {
  const empty = (reason: string, expiration: string | null = null, daysToExpiration: number | null = null, points: IvSkewPoint[] = []): IvSkewResult => ({
    status: "INSUFFICIENT", expiration, daysToExpiration, call25Iv: null, put25Iv: null, call25Strike: null, put25Strike: null,
    riskReversalVolPoints: null, label: "样本不足", reason, points,
  });
  if (!chain.length || !Number.isFinite(close) || close <= 0) return empty("当前没有可用期权链。");

  const tradeDate = [...chain].sort((a, b) => b.tradeDate.localeCompare(a.tradeDate))[0]?.tradeDate;
  if (!tradeDate) return empty("缺少期权交易日期。");
  const expirations = [...new Set(chain.map((row) => row.expiration))]
    .map((expiration) => ({ expiration, days: daysBetween(tradeDate, expiration) }))
    .filter((item) => item.days > 0)
    .sort((a, b) => {
      const aPenalty = a.days >= 7 ? 0 : 100;
      const bPenalty = b.days >= 7 ? 0 : 100;
      return aPenalty - bPenalty || Math.abs(a.days - 30) - Math.abs(b.days - 30) || a.days - b.days;
    });
  const selected = expirations[0];
  if (!selected) return empty("当前范围没有未到期合约。");

  const usable = chain.filter((row) => row.expiration === selected.expiration
    && row.impliedVolatility !== null && Number.isFinite(row.impliedVolatility)
    && row.impliedVolatility > 0 && row.impliedVolatility < 5
    && (row.openInterest ?? 0) > 0
    && row.strike >= close * 0.8 && row.strike <= close * 1.2);
  const strikes = [...new Set(usable.map((row) => row.strike))].sort((a, b) => a - b);
  const points = strikes.map((strike) => ({
    strike,
    moneyness: strike / close,
    callIv: average(usable.filter((row) => row.strike === strike && row.optionType === "CALL").map((row) => row.impliedVolatility!)),
    putIv: average(usable.filter((row) => row.strike === strike && row.optionType === "PUT").map((row) => row.impliedVolatility!)),
  }));
  if (points.length < 5) return empty("近价且有持仓的有效行权价少于 5 个。", selected.expiration, selected.days, points);

  const calls = usable.filter((row) => row.optionType === "CALL" && row.strike >= close && row.delta !== null && row.delta > 0)
    .sort((a, b) => Math.abs(a.delta! - 0.25) - Math.abs(b.delta! - 0.25));
  const puts = usable.filter((row) => row.optionType === "PUT" && row.strike <= close && row.delta !== null && row.delta < 0)
    .sort((a, b) => Math.abs(Math.abs(a.delta!) - 0.25) - Math.abs(Math.abs(b.delta!) - 0.25));
  const call25 = calls[0];
  const put25 = puts[0];
  if (!call25 || !put25 || Math.abs(call25.delta! - 0.25) > 0.15 || Math.abs(Math.abs(put25.delta!) - 0.25) > 0.15) {
    return empty("缺少足够接近 25Δ 的看涨或看跌合约。", selected.expiration, selected.days, points);
  }

  const riskReversalVolPoints = (put25.impliedVolatility! - call25.impliedVolatility!) * 100;
  const label = riskReversalVolPoints >= 3 ? "Put侧 IV 更高" : riskReversalVolPoints <= -3 ? "Call侧 IV 更高" : "两侧 IV 接近";
  return {
    status: "AVAILABLE",
    expiration: selected.expiration,
    daysToExpiration: selected.days,
    call25Iv: call25.impliedVolatility,
    put25Iv: put25.impliedVolatility,
    call25Strike: call25.strike,
    put25Strike: put25.strike,
    riskReversalVolPoints,
    label,
    reason: "选择至少7天、尽量接近30天的可用合约，比较 Delta 约为25%的 Put 与 Call。",
    points,
  };
}
