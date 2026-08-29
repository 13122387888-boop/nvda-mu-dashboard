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
  relativeVolume: number | null;
  dailyChangePct: number | null;
  bollinger: {
    percentB: number | null;
    bandwidthPercentile: number | null;
    state: "SQUEEZE" | "WIDE" | "NORMAL" | "UNAVAILABLE";
  };
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

const price = (value: number) => `$${value.toFixed(2)}`;

function trendBrief(status: MarketStatusValue): BriefItem {
  const states: Record<MarketStatusValue, BriefItem> = {
    STRONG_BULLISH: { label: "趋势", state: "强势偏多", detail: "收盘价与均线呈多头排列，且 RSI ≥ 55", tone: "positive" },
    BULLISH: { label: "趋势", state: "偏多", detail: "收盘价、MA100 与 MA200 保持偏多结构", tone: "positive" },
    NEUTRAL: { label: "趋势", state: "中性", detail: "均线尚未形成明确的同向结构", tone: "neutral" },
    BEARISH: { label: "趋势", state: "偏空", detail: "收盘价、MA100 与 MA200 保持偏空结构", tone: "negative" },
    INSUFFICIENT_DATA: { label: "趋势", state: "数据不足", detail: "历史数据不足以完成长期均线判断", tone: "neutral" },
  };
  return states[status];
}

function bollingerPosition(percentB: number | null) {
  if (percentB === null) return "BOLL位置暂无";
  if (percentB >= 1) return "上轨外";
  if (percentB >= 0.75) return "上轨附近";
  if (percentB >= 0.5) return "中轨上方";
  if (percentB >= 0.25) return "中轨下方";
  if (percentB >= 0) return "下轨附近";
  return "下轨外";
}

function shortTermBrief(rsi: number | null, bollinger: DecisionSupportInput["bollinger"]): BriefItem {
  const position = bollingerPosition(bollinger.percentB);
  const bandwidth = bollinger.state === "SQUEEZE" ? "带宽收口" : bollinger.state === "WIDE" ? "带宽偏宽" : bollinger.state === "NORMAL" ? "带宽常态" : "带宽暂无";
  if (rsi === null) return { label: "短线状态", state: position, detail: `RSI暂无；${position}，${bandwidth}`, tone: "neutral" };
  const rsiState = rsi >= 70 ? "偏热" : rsi <= 30 ? "偏冷" : rsi >= 55 ? "偏强" : rsi <= 45 ? "偏弱" : "中性";
  if (bollinger.percentB === null) return { label: "短线状态", state: `${rsiState}·${position}`, detail: `RSI14 ${rsi.toFixed(1)}；${position}，${bandwidth}`, tone: "neutral" };
  const tone: BriefTone = rsi >= 70 || rsi <= 30 ? "warning" : rsi >= 55 && (bollinger.percentB ?? 0.5) >= 0.5 ? "positive" : rsi <= 45 && (bollinger.percentB ?? 0.5) <= 0.5 ? "negative" : "neutral";
  return { label: "短线状态", state: `${rsiState}·${position}`, detail: `RSI14 ${rsi.toFixed(1)}；${position}，${bandwidth}`, tone };
}

function volumeBrief(input: DecisionSupportInput): BriefItem {
  const rvol = input.relativeVolume;
  if (rvol === null) return { label: "量能", state: "数据不足", detail: "暂无可用 RVOL20", tone: "neutral" };
  const trendPositive = input.marketStatus === "STRONG_BULLISH" || input.marketStatus === "BULLISH";
  const trendNegative = input.marketStatus === "BEARISH";
  if (rvol >= 1.5) {
    if (trendPositive && (input.dailyChangePct ?? 0) > 0) return { label: "量能", state: "放量确认", detail: `RVOL ${rvol.toFixed(1)}×，上涨方向与偏强趋势一致`, tone: "positive" };
    if (trendNegative && (input.dailyChangePct ?? 0) < 0) return { label: "量能", state: "弱势放量", detail: `RVOL ${rvol.toFixed(1)}×，下跌方向与偏空趋势一致`, tone: "negative" };
    return { label: "量能", state: "放量需复核", detail: `RVOL ${rvol.toFixed(1)}×，但价格方向与主趋势未形成一致确认`, tone: "warning" };
  }
  if (rvol <= 0.7) return { label: "量能", state: "参与偏淡", detail: `RVOL ${rvol.toFixed(1)}×，当前走势缺少明显成交参与`, tone: "neutral" };
  return { label: "量能", state: "成交常态", detail: `RVOL ${rvol.toFixed(1)}×，成交量处于常态区间`, tone: "neutral" };
}

function volatilityState(atmIv: number | null, rv20: number | null) {
  if (atmIv === null || rv20 === null || rv20 <= 0) return "IV比较暂无";
  const ratio = atmIv / rv20;
  return ratio >= 1.2 ? "IV高于实际波动" : ratio <= 0.8 ? "IV低于实际波动" : "IV与实际波动接近";
}

function optionsBrief(regime: GammaRegime, atmIv: number | null, rv20: number | null): BriefItem {
  const gamma = {
    POSITIVE: { state: "正Gamma", detail: "关键位附近更偏震荡观察", tone: "positive" as const },
    NEGATIVE: { state: "负Gamma", detail: "突破关键位后需关注波动放大", tone: "negative" as const },
    NEUTRAL: { state: "Gamma中性", detail: "Call与Put结构代理较均衡", tone: "neutral" as const },
    UNAVAILABLE: { state: "Gamma暂无", detail: "当前Greeks或持仓数据不足", tone: "neutral" as const },
  };
  const current = gamma[regime];
  const iv = volatilityState(atmIv, rv20);
  return { label: "期权环境", state: `${current.state}·${iv}`, detail: `${current.detail}；${iv}`, tone: current.tone };
}

export function buildResearchBrief(input: DecisionSupportInput) {
  const items = [
    trendBrief(input.marketStatus),
    shortTermBrief(input.rsi14, input.bollinger),
    volumeBrief(input),
    optionsBrief(input.gammaRegime, input.atmIv, input.rv20),
  ];
  return {
    items,
    summary: `${items[0].state}；短线${items[1].state}，${items[2].state}。期权环境：${items[3].state}。`,
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
