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
    STRONG_BULLISH: { label: "大方向", state: "明显偏强", detail: "收盘价和均线整体向上排列，RSI 也偏强", tone: "positive" },
    BULLISH: { label: "大方向", state: "偏强", detail: "收盘价、100日线和200日线保持偏强排列", tone: "positive" },
    NEUTRAL: { label: "大方向", state: "方向不明确", detail: "均线还没有形成一致方向", tone: "neutral" },
    BEARISH: { label: "大方向", state: "偏弱", detail: "收盘价、100日线和200日线保持偏弱排列", tone: "negative" },
    INSUFFICIENT_DATA: { label: "大方向", state: "数据不足", detail: "历史数据还不够，暂时无法判断长期方向", tone: "neutral" },
  };
  return states[status];
}

function bollingerPosition(percentB: number | null) {
  if (percentB === null) return "价格通道位置暂无";
  if (percentB >= 1) return "高于上轨";
  if (percentB >= 0.75) return "靠近上轨";
  if (percentB >= 0.5) return "位于中轨上方";
  if (percentB >= 0.25) return "位于中轨下方";
  if (percentB >= 0) return "靠近下轨";
  return "低于下轨";
}

function shortTermBrief(rsi: number | null, bollinger: DecisionSupportInput["bollinger"]): BriefItem {
  const position = bollingerPosition(bollinger.percentB);
  const bandwidth = bollinger.state === "SQUEEZE" ? "通道偏窄" : bollinger.state === "WIDE" ? "通道偏宽" : bollinger.state === "NORMAL" ? "通道宽度正常" : "通道宽度暂无";
  if (rsi === null) return { label: "近期强弱", state: position, detail: `RSI 暂无；${position}，${bandwidth}`, tone: "neutral" };
  const rsiState = rsi >= 70 ? "偏热" : rsi <= 30 ? "偏冷" : rsi >= 55 ? "偏强" : rsi <= 45 ? "偏弱" : "中性";
  if (bollinger.percentB === null) return { label: "近期强弱", state: `${rsiState} · ${position}`, detail: `RSI ${rsi.toFixed(1)}；${position}，${bandwidth}`, tone: "neutral" };
  const tone: BriefTone = rsi >= 70 || rsi <= 30 ? "warning" : rsi >= 55 && (bollinger.percentB ?? 0.5) >= 0.5 ? "positive" : rsi <= 45 && (bollinger.percentB ?? 0.5) <= 0.5 ? "negative" : "neutral";
  return { label: "近期强弱", state: `${rsiState} · ${position}`, detail: `RSI ${rsi.toFixed(1)}；${position}，${bandwidth}`, tone };
}

function volumeBrief(input: DecisionSupportInput): BriefItem {
  const rvol = input.relativeVolume;
  if (rvol === null) return { label: "成交量", state: "数据不足", detail: "暂无可用相对成交量", tone: "neutral" };
  const trendPositive = input.marketStatus === "STRONG_BULLISH" || input.marketStatus === "BULLISH";
  const trendNegative = input.marketStatus === "BEARISH";
  if (rvol >= 1.5) {
    if (trendPositive && (input.dailyChangePct ?? 0) > 0) return { label: "成交量", state: "成交放大且与上涨配合", detail: `成交量是近期平均的 ${rvol.toFixed(1)} 倍，价格上涨且大方向偏强`, tone: "positive" };
    if (trendNegative && (input.dailyChangePct ?? 0) < 0) return { label: "成交量", state: "放量下跌", detail: `成交量是近期平均的 ${rvol.toFixed(1)} 倍，价格下跌且大方向偏弱`, tone: "negative" };
    return { label: "成交量", state: "成交放大，但方向不一致", detail: `成交量是近期平均的 ${rvol.toFixed(1)} 倍，但价格和大方向没有同时配合`, tone: "warning" };
  }
  if (rvol <= 0.7) return { label: "成交量", state: "成交偏少", detail: `成交量只有近期平均的 ${rvol.toFixed(1)} 倍`, tone: "neutral" };
  return { label: "成交量", state: "成交正常", detail: `成交量是近期平均的 ${rvol.toFixed(1)} 倍`, tone: "neutral" };
}

function volatilityState(atmIv: number | null, rv20: number | null) {
  if (atmIv === null || rv20 === null || rv20 <= 0) return "波动对比暂无";
  const ratio = atmIv / rv20;
  return ratio >= 1.2 ? "期权预估高于近期实际" : ratio <= 0.8 ? "期权预估低于近期实际" : "期权预估与近期实际接近";
}

function optionsBrief(regime: GammaRegime, atmIv: number | null, rv20: number | null): BriefItem {
  const gamma = {
    POSITIVE: { state: "Gamma估算偏正", detail: "Call侧估算较大，不能据此确认波动会收敛", tone: "positive" as const },
    NEGATIVE: { state: "Gamma估算偏负", detail: "Put侧估算较大，不能据此确认波动会放大", tone: "negative" as const },
    NEUTRAL: { state: "Gamma两侧接近", detail: "Call与Put两侧估算值接近", tone: "neutral" as const },
    UNAVAILABLE: { state: "Gamma数据暂无", detail: "当前Gamma或未平仓量数据不足", tone: "neutral" as const },
  };
  const current = gamma[regime];
  const iv = volatilityState(atmIv, rv20);
  return { label: "期权波动", state: `${current.state} · ${iv}`, detail: `${current.detail}；${iv}`, tone: current.tone };
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
    summary: `${items[0].state}；近期${items[1].state}；${items[2].state}。期权：${items[3].state}。`,
  };
}

export function buildObservationScenarios(input: ScenarioInput): ObservationScenario[] {
  const { close, callWall, putWall, marketStatus, gammaRegime } = input;
  const trendPositive = marketStatus === "STRONG_BULLISH" || marketStatus === "BULLISH";
  const trendNegative = marketStatus === "BEARISH";

  let currentTitle = "等待关键位数据";
  let currentCondition = "期权关键位不足，暂不判断价格所在区间";
  const currentTone: BriefTone = "neutral";
  if (callWall !== null && close > callWall) {
    currentTitle = "收盘价在看涨墙上方";
    currentCondition = `${price(close)} 高于看涨墙 ${price(callWall)}`;
  } else if (putWall !== null && close < putWall) {
    currentTitle = "收盘价在看跌墙下方";
    currentCondition = `${price(close)} 低于看跌墙 ${price(putWall)}`;
  } else if (callWall !== null && putWall !== null) {
    currentTitle = "收盘价在两个墙位之间";
    currentCondition = `${price(putWall)} < ${price(close)} < ${price(callWall)}`;
  }

  const currentObservation = gammaRegime === "POSITIVE"
    ? "Gamma估算偏正；它只提供结构线索，继续观察关键位附近是否更容易震荡。"
    : gammaRegime === "NEGATIVE"
      ? "Gamma估算偏负；它只提供结构线索，继续观察离开关键位后波动是否扩大。"
      : "Gamma两侧没有明显差异，先观察价格与关键位的关系。";

  const upside: ObservationScenario = callWall === null
    ? { label: "如果向上", title: "看涨墙数据不足", condition: "暂无可用看涨墙", observation: "暂时无法生成向上观察条件。", invalidation: "取得关键价位数据后重新计算。", tone: "neutral" }
    : {
        label: "如果向上",
        title: "如果收盘站上看涨墙",
        condition: `日线收盘站上 ${price(callWall)}`,
        observation: trendPositive ? "如果均线仍然偏强，再观察上涨能否延续。" : "还要看均线是否转强，单独站上墙位不能确认趋势。",
        invalidation: `收盘重新回到 ${price(callWall)} 下方。`,
        tone: "positive",
      };

  const downside: ObservationScenario = putWall === null
    ? { label: "如果向下", title: "看跌墙数据不足", condition: "暂无可用看跌墙", observation: "暂时无法生成向下观察条件。", invalidation: "取得关键价位数据后重新计算。", tone: "neutral" }
    : {
        label: "如果向下",
        title: "如果收盘跌破看跌墙",
        condition: `日线收盘跌破 ${price(putWall)}`,
        observation: gammaRegime === "NEGATIVE" || trendNegative ? "如果大方向也偏弱，继续观察波动是否扩大。" : "还要看大方向是否同步转弱，单独跌破墙位可能很快收回。",
        invalidation: `收盘重新回到 ${price(putWall)} 上方。`,
        tone: "negative",
      };

  return [
    {
      label: "当前状态",
      title: currentTitle,
      condition: currentCondition,
      observation: currentObservation,
      invalidation: "下一次收盘位置或 Gamma 估算发生变化后重新判断。",
      tone: currentTone,
    },
    upside,
    downside,
  ];
}
