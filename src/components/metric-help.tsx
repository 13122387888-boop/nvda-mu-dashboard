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
    read: "数值越高，说明近期价格波动越剧烈。",
    caveat: "它只总结过去，不是未来波动率预测，也不是单日预期涨跌幅。",
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
