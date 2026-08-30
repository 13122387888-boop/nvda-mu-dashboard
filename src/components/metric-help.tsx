"use client";

import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export const METRIC_GLOSSARY = {
  movingAverage: {
    title: "移动平均线（MA）",
    plain: "过去 50、100 或 200 个交易日的平均收盘价，用来帮助观察趋势。",
    what: "一段时间内收盘价的平均值，不是投资者的持仓成本。",
    formula: "MA50、MA100、MA200 分别取最近 50、100、200 个交易日调整后收盘价的算术平均。",
    read: "看现价在三条均线上方还是下方，以及三条线是否按同一方向排列。",
    caveat: "均线是滞后指标，不是必然有效的支撑位、阻力位或买卖信号。",
  },
  rsi14: {
    title: "RSI 14",
    plain: "最近涨跌力度的温度计，用 0–100 表示。",
    what: "衡量近期上涨力度与下跌力度相对强弱的动量指标，取值为 0–100。",
    formula: "使用 Wilder 方法平滑最近 14 个交易日的平均涨幅与平均跌幅。",
    read: "70 以上通常称为偏热，30 以下称为偏冷；中间区域用于观察动量强弱变化。",
    caveat: "偏热不等于马上下跌，偏冷也不等于马上反弹；强趋势中可长时间停留在极端区域。",
  },
  bollinger: {
    title: "布林带（BOLL 20,2）",
    plain: "把近期价格装进一条通道，看现价靠近上轨还是下轨，以及通道相对历史偏窄还是偏宽。",
    what: "以20日均值为中轨，在上下各放置两倍标准差，形成随波动变化的价格通道。",
    formula: "使用调整后收盘价：中轨为20日简单平均；上轨/下轨为中轨 ± 2倍20日总体标准差；%B表示价格在上下轨之间的位置，带宽表示通道宽度。",
    read: "%B接近1代表靠近上轨、接近0代表靠近下轨；宽度排名较低表示通道相对偏窄，较高表示相对偏宽。",
    caveat: "触及上轨不等于卖出，触及下轨也不等于买入；通道偏窄不能预测后续突破方向。",
  },
  relativeVolume: {
    title: "今天的成交活跃度（相对成交量）",
    plain: "今天的成交量相当于平时的多少倍。",
    what: "比较当日成交量与此前20个交易日平均成交量，观察当前价格变化是否有明显成交参与。",
    formula: "当日实际成交量 ÷ 此前20个交易日平均成交量；基准窗口不包含当天，至少需要10个有效样本。",
    read: "1.5倍以上称为明显活跃，0.7倍以下称为参与偏淡；必须结合当日涨跌与趋势方向解读。",
    caveat: "放量本身没有多空方向；拆股等公司行动也可能令短期成交量对比失真。",
  },
  rv20: {
    title: "近20日实际波动（RV20）",
    plain: "这只股票最近 20 个交易日实际晃动得有多厉害。",
    what: "描述股票过去一段时间实际发生了多大幅度的波动，不判断涨跌方向。",
    formula: "计算最近 20 个交易日对数收益率的样本标准差，再乘以 √252 年化。",
    read: "数值越高，说明近期价格波动越剧烈；适合与隐含波动率比较。",
    caveat: "它只总结过去，不是未来波动率预测，也不是单日预期涨跌幅。",
  },
  atmIv: {
    title: "期权预估波动（ATM IV）",
    plain: "从最近到期、接近现价的期权价格中反推出的年化波动大小。",
    what: "期权价格反推出的市场波动定价，ATM 指行权价最接近当前股价。",
    formula: "取最近到期、最接近平值行权价的可用 Call 与 Put 隐含波动率平均值。",
    read: "与 RV20 对比，可观察期权定价的未来波动是否高于或低于近期实际波动。",
    caveat: "IV 高不等于期权一定贵；财报、期限、偏斜和供需都会影响价格。",
  },
  expectedRange: {
    title: "最近到期期权估算区间",
    plain: "最近到期期权价格已经计入了多大的价格变动。",
    what: "以当前收盘价为中心，用最近到期的近平值 Call 与 Put 价格估算上下波动幅度。",
    formula: "在所选期限范围内采用最近到期日：预期波动 = 平值 Call 与 Put 的价格之和；上下沿 = 当前收盘价 ± 预期波动。",
    read: "把现价、上下沿和其他关键价位放在一起，可看哪些价位已经超出当前期权计入的幅度。",
    caveat: "这不是最高价、最低价、概率区间或目标价，价格完全可能落在区间之外。",
  },
  maxPain: {
    title: "最大痛点",
    plain: "按当前持仓估算，期权到期时整体赔付最少的价位。",
    what: "假设期权在某个行权价到期结算时，全部未平仓期权买方合计内在价值最低的位置。",
    formula: "逐个候选行权价计算全部 Call 与 Put 的到期内在价值乘以未平仓量，取总额最小者。",
    read: "可作为到期持仓结构的集中参考，并与现价距离一起观察。",
    caveat: "它不代表价格会被吸向该处；计算范围取决于数据源返回的最近到期合约。",
  },
  callWall: {
    title: "看涨墙",
    plain: "所选到期范围内，Call 未平仓合约最多的价位。",
    what: "当前期权样本中 Call 未平仓量最大的行权价。",
    formula: "在所选期限范围内，先按行权价汇总全部 Call 未平仓量，再取合计最高的行权价。",
    read: "可观察 Call 合约集中在哪里，以及现价距离该位置还有多远。",
    caveat: "它不等于确定阻力位，也无法从公开未平仓量判断持仓者实际多空方向；当前只在数据源返回的有限样本内计算，可能与券商完整链不同。",
  },
  putWall: {
    title: "看跌墙",
    plain: "所选到期范围内，Put 未平仓合约最多的价位。",
    what: "当前期权样本中 Put 未平仓量最大的行权价。",
    formula: "在所选期限范围内，先按行权价汇总全部 Put 未平仓量，再取合计最高的行权价。",
    read: "可观察 Put 合约集中在哪里，以及现价距离该位置还有多远。",
    caveat: "它不等于确定支撑位，也无法从公开未平仓量判断持仓者实际多空方向；当前只在数据源返回的有限样本内计算，可能与券商完整链不同。",
  },
  putCallOi: {
    title: "Put 与 Call 未平仓量比",
    plain: "还没结束的 Put 合约数量除以 Call 合约数量。",
    what: "比较当前期权样本中 Put 与 Call 未平仓合约数量的比例。",
    formula: "全部 Put 未平仓量之和 ÷ 全部 Call 未平仓量之和。",
    read: "大于 1 表示 Put 持仓数量更多，小于 1 表示 Call 持仓数量更多。",
    caveat: "比例不能直接解释为看空或看多，因为无法识别买方、卖方及组合策略。",
  },
  gammaProxy: {
    title: "Call / Put Gamma 结构估算",
    plain: "按页面约定，比较 Call 侧和 Put 侧的 Gamma 加权持仓谁更大。",
    what: "用公开期权 Gamma 与未平仓量估算不同期权结构对价格变化敏感度的相对分布。",
    formula: "单合约 Gamma × 未平仓量 × 合约乘数 × 股价² × 1%；页面统一按 Call 为正、Put 为负汇总。",
    read: "正值表示 Call 侧估算更大，负值表示 Put 侧估算更大；它只描述公开合约结构。",
    caveat: "这不是真实做市商 Gamma；无法识别持仓者和买卖方向，也不能据此确认波动一定收敛或放大。",
  },
  openInterest: {
    title: "未平仓量（OI）",
    plain: "已经建立、但还没有结束的期权合约数量。",
    what: "尚未通过平仓、行权或到期结束的期权合约数量。",
    formula: "由数据源按到期日、行权价和 Call/Put 类型提供；页面把所选期限内相同行权价的数据相加后展示。",
    read: "柱越长表示该行权价现有合约越集中，可用于定位持仓密集区域。",
    caveat: "OI 不是当日成交量，也不表示这些合约是净买入、净卖出或新增方向。",
  },
} as const;

export type MetricHelpKey = keyof typeof METRIC_GLOSSARY;

export function MetricLabel({ children, metric }: { children: ReactNode; metric: MetricHelpKey }) {
  const item = METRIC_GLOSSARY[metric];
  const titleId = useId();
  const [rendered, setRendered] = useState(false);
  const [active, setActive] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    setActive(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setRendered(false), 240);
  }, []);

  const open = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setRendered(true);
  };

  useEffect(() => {
    if (!rendered) return;
    const previousOverflow = document.body.style.overflow;
    const frame = requestAnimationFrame(() => setActive(true));
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, rendered]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  return (
    <>
      <button type="button" className="metric-note-trigger" onClick={open} aria-haspopup="dialog" aria-expanded={rendered}>
        {children}
      </button>
      {rendered && createPortal(
        <div className={`metric-note-overlay ${active ? "active" : ""}`} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
          <section className="metric-note-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <div className="metric-note-handle" aria-hidden="true" />
            <div className="metric-note-heading"><span>这个指标怎么理解</span><button type="button" onClick={close}>关闭</button></div>
            <h2 id={titleId}>{item.title}</h2>
            <div className="metric-note-plain"><span>简单理解</span><strong>{item.plain}</strong></div>
            <dl>
              <div><dt>它是什么</dt><dd>{item.what}</dd></div>
              <div><dt>怎么算</dt><dd>{item.formula}</dd></div>
              <div><dt>主要看什么</dt><dd>{item.read}</dd></div>
              <div><dt>不能这样理解</dt><dd>{item.caveat}</dd></div>
            </dl>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
