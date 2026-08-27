import type { GammaRegime } from "@/lib/indicators/options/gamma-exposure";
import type { MarketStatusValue } from "@/lib/indicators/stock-metrics";

export type BriefTone = "positive" | "negative" | "neutral" | "warning";

export type BriefItem = {
  label: string;
  state: string;
  detail: string;
  tone: BriefTone;
};

export type DecisionSupportInput = {
  marketStatus: MarketStatusValue;
  rsi14: number | null;
  rv20: number | null;
  atmIv: number | null;
  gammaRegime: GammaRegime;
};

export type ScenarioInput = {
  close: number;
  callWall: number | null;
  putWall: number | null;
  marketStatus: MarketStatusValue;
  gammaRegime: GammaRegime;
};

export type ObservationScenario = {
  label: string;
  title: string;
  condition: string;
  observation: string;
  invalidation: string;
  tone: BriefTone;
};

export type ObservationChecklistItem = {
  label: string;
  status: string;
  condition: string;
  detail: string;
  tone: BriefTone;
};

export type ObservationChecklistInput = {
  close: number;
  callWall: number | null;
  putWall: number | null;
  expectedUpper: number | null;
  expectedLower: number | null;
  gammaRegime: GammaRegime;
};

const price = (value: number) => `$${value.toFixed(2)}`;

function trendBrief(status: MarketStatusValue): BriefItem {
  const states: Record<MarketStatusValue, BriefItem> = {
    STRONG_BULLISH: { label: "趋势", state: "强势偏多", detail: "收盘价与均线呈多头排列，且 RSI ≥ 55", tone: "positive" },
    BULLISH: { label: "趋势", state: "偏多", detail: "收盘价高于50日线，且50日线高于200日线", tone: "positive" },
    NEUTRAL: { label: "趋势", state: "中性", detail: "均线尚未形成明确的同向结构", tone: "neutral" },
    BEARISH: { label: "趋势", state: "偏空", detail: "收盘价低于50日线，且50日线低于200日线", tone: "negative" },
    INSUFFICIENT_DATA: { label: "趋势", state: "数据不足", detail: "历史数据不足以完成长期均线判断", tone: "neutral" },
  };
  return states[status];
}

function momentumBrief(rsi: number | null): BriefItem {
  if (rsi === null) return { label: "动量", state: "数据不足", detail: "暂无可用 RSI14", tone: "neutral" };
  if (rsi >= 70) return { label: "动量", state: "偏热", detail: `RSI14 ${rsi.toFixed(1)}，处于70以上`, tone: "warning" };
  if (rsi <= 30) return { label: "动量", state: "偏冷", detail: `RSI14 ${rsi.toFixed(1)}，处于30以下`, tone: "warning" };
  if (rsi >= 55) return { label: "动量", state: "偏强", detail: `RSI14 ${rsi.toFixed(1)}，位于中性区上部`, tone: "positive" };
  if (rsi <= 45) return { label: "动量", state: "偏弱", detail: `RSI14 ${rsi.toFixed(1)}，位于中性区下部`, tone: "negative" };
  return { label: "动量", state: "中性", detail: `RSI14 ${rsi.toFixed(1)}，处于45–55之间`, tone: "neutral" };
}

function volatilityBrief(atmIv: number | null, rv20: number | null): BriefItem {
  if (atmIv === null || rv20 === null || rv20 <= 0) {
    return { label: "波动定价", state: "数据不足", detail: "需要同时具备 ATM IV 与 RV20", tone: "neutral" };
  }
  const ratio = atmIv / rv20;
  const spreadPoints = (atmIv - rv20) * 100;
  const spread = `${spreadPoints >= 0 ? "+" : ""}${spreadPoints.toFixed(1)}个百分点`;
  if (ratio >= 1.2) return { label: "波动定价", state: "隐含波动较高", detail: `ATM IV 相对 RV20 为 ${spread}`, tone: "warning" };
  if (ratio <= 0.8) return { label: "波动定价", state: "隐含波动较低", detail: `ATM IV 相对 RV20 为 ${spread}`, tone: "neutral" };
  return { label: "波动定价", state: "两者接近", detail: `ATM IV 相对 RV20 为 ${spread}`, tone: "neutral" };
}

function gammaBrief(regime: GammaRegime): BriefItem {
  const states: Record<GammaRegime, BriefItem> = {
    POSITIVE: { label: "期权结构", state: "正 Gamma 代理", detail: "关键位附近更偏震荡与均值回归观察", tone: "positive" },
    NEGATIVE: { label: "期权结构", state: "负 Gamma 代理", detail: "突破关键位后需关注波动放大风险", tone: "negative" },
    NEUTRAL: { label: "期权结构", state: "Gamma 接近中性", detail: "Call 与 Put 的结构代理较为均衡", tone: "neutral" },
    UNAVAILABLE: { label: "期权结构", state: "数据不足", detail: "当前 Greeks 或持仓数据不足", tone: "neutral" },
  };
  return states[regime];
}

export function buildResearchBrief(input: DecisionSupportInput) {
  const items = [
    trendBrief(input.marketStatus),
    momentumBrief(input.rsi14),
    volatilityBrief(input.atmIv, input.rv20),
    gammaBrief(input.gammaRegime),
  ];
  return {
    items,
    summary: `${items[0].state}、动量${items[1].state}；${items[2].state}，期权结构为${items[3].state}。`,
  };
}

export function buildObservationScenarios(input: ScenarioInput): ObservationScenario[] {
  const { close, callWall, putWall, marketStatus, gammaRegime } = input;
  const trendPositive = marketStatus === "STRONG_BULLISH" || marketStatus === "BULLISH";
  const trendNegative = marketStatus === "BEARISH";

  let currentTitle = "等待关键位数据";
  let currentCondition = "期权关键位不足，暂不判断价格所在区间";
  let currentTone: BriefTone = "neutral";
  if (callWall !== null && close > callWall) {
    currentTitle = "现价位于看涨墙上方";
    currentCondition = `${price(close)} 高于看涨墙 ${price(callWall)}`;
    currentTone = "positive";
  } else if (putWall !== null && close < putWall) {
    currentTitle = "现价位于看跌墙下方";
    currentCondition = `${price(close)} 低于看跌墙 ${price(putWall)}`;
    currentTone = "negative";
  } else if (callWall !== null && putWall !== null) {
    currentTitle = "现价处于两堵墙之间";
    currentCondition = `${price(putWall)} < ${price(close)} < ${price(callWall)}`;
  }

  const currentObservation = gammaRegime === "POSITIVE"
    ? "正 Gamma 结构代理下，关键位附近更偏区间与均值回归观察。"
    : gammaRegime === "NEGATIVE"
      ? "负 Gamma 结构代理下，价格离开关键位后需关注波动放大风险。"
      : "Gamma 结构未形成明确方向，等待价格与关键位进一步确认。";

  const upside: ObservationScenario = callWall === null
    ? { label: "上方情景", title: "看涨墙数据不足", condition: "暂无可用看涨墙", observation: "不生成上方突破观察。", invalidation: "取得完整关键位数据后重新计算。", tone: "neutral" }
    : {
        label: "上方情景",
        title: "关注看涨墙突破",
        condition: `日线收盘站上 ${price(callWall)}`,
        observation: trendPositive ? "若均线偏多结构保持，关注趋势能否延续。" : "需要同时观察均线是否转强，单一关键位不足以确认趋势。",
        invalidation: `收盘重新回到 ${price(callWall)} 下方。`,
        tone: "positive",
      };

  const downside: ObservationScenario = putWall === null
    ? { label: "下方情景", title: "看跌墙数据不足", condition: "暂无可用看跌墙", observation: "不生成下方突破观察。", invalidation: "取得完整关键位数据后重新计算。", tone: "neutral" }
    : {
        label: "下方情景",
        title: "关注看跌墙跌破",
        condition: `日线收盘跌破 ${price(putWall)}`,
        observation: gammaRegime === "NEGATIVE" || trendNegative ? "负 Gamma 或偏空趋势共振时，重点关注波动扩张风险。" : "需要观察趋势与 Gamma 是否同步转弱，单一跌破可能形成假信号。",
        invalidation: `收盘重新回到 ${price(putWall)} 上方。`,
        tone: "negative",
      };

  return [
    {
      label: "当前状态",
      title: currentTitle,
      condition: currentCondition,
      observation: currentObservation,
      invalidation: "下一交易日收盘位置或 Gamma 结构变化后重新判断。",
      tone: currentTone,
    },
    upside,
    downside,
  ];
}

export function buildObservationChecklist(input: ObservationChecklistInput): ObservationChecklistItem[] {
  const { close, callWall, putWall, expectedUpper, expectedLower, gammaRegime } = input;
  const distance = (level: number) => Math.abs(level - close) / close;
  const upside: ObservationChecklistItem = callWall === null
    ? { label: "上方条件", status: "数据不足", condition: "暂无看涨墙", detail: "暂不生成上方关键位观察。", tone: "neutral" }
    : close >= callWall
      ? { label: "上方条件", status: "已经越过", condition: `收盘价已位于 ${price(callWall)} 看涨墙上方`, detail: "下一步观察收盘能否继续保持在该价位上方。", tone: "positive" }
      : distance(callWall) <= 0.015
        ? { label: "上方条件", status: "正在接近", condition: `距离 ${price(callWall)} 看涨墙不足 1.5%`, detail: "仍需等待日线收盘站上，盘中触及不视为确认。", tone: "warning" }
        : { label: "上方条件", status: "尚未触发", condition: `日线收盘站上 ${price(callWall)}`, detail: `当前距离约 ${(distance(callWall) * 100).toFixed(1)}%。`, tone: "neutral" };

  const downside: ObservationChecklistItem = putWall === null
    ? { label: "下方条件", status: "数据不足", condition: "暂无看跌墙", detail: "暂不生成下方关键位观察。", tone: "neutral" }
    : close <= putWall
      ? { label: "下方条件", status: "已经跌破", condition: `收盘价已位于 ${price(putWall)} 看跌墙下方`, detail: "下一步观察收盘能否重新回到该价位上方。", tone: "negative" }
      : distance(putWall) <= 0.015
        ? { label: "下方条件", status: "正在接近", condition: `距离 ${price(putWall)} 看跌墙不足 1.5%`, detail: "仍需等待日线收盘跌破，盘中触及不视为确认。", tone: "warning" }
        : { label: "下方条件", status: "尚未触发", condition: `日线收盘跌破 ${price(putWall)}`, detail: `当前距离约 ${(distance(putWall) * 100).toFixed(1)}%。`, tone: "neutral" };

  const gammaStates: Record<GammaRegime, { status: string; detail: string; tone: BriefTone }> = {
    POSITIVE: { status: "正 Gamma 代理", detail: "关键位附近优先观察区间与均值回归特征。", tone: "positive" },
    NEGATIVE: { status: "负 Gamma 代理", detail: "价格离开关键位后优先警惕波动放大。", tone: "negative" },
    NEUTRAL: { status: "Gamma 中性", detail: "当前结构没有给出清晰的波动抑制或放大倾向。", tone: "neutral" },
    UNAVAILABLE: { status: "数据不足", detail: "Greeks 或持仓数据不足，暂不判断 Gamma 环境。", tone: "neutral" },
  };
  const gamma = gammaStates[gammaRegime];
  const range = expectedLower === null || expectedUpper === null
    ? "预期区间数据不足"
    : `${price(expectedLower)}–${price(expectedUpper)}`;
  const environment: ObservationChecklistItem = {
    label: "波动环境",
    status: gamma.status,
    condition: `当前到期预期区间 ${range}`,
    detail: gamma.detail,
    tone: gamma.tone,
  };

  return [upside, downside, environment];
}
