import type { ReactNode } from "react";

export const METRIC_GLOSSARY = {
  movingAverage: {
    title: "移动平均线（MA）",
    what: "一段时间内收盘价的平均值，用来压缩短期噪声、观察趋势方向。",
    formula: "MA20、MA50、MA200 分别取最近 20、50、200 个交易日调整后收盘价的算术平均。",
    read: "价格与短、中、长期均线的相对位置，可帮助判断趋势是否一致。",
    caveat: "均线是滞后指标，不是必然有效的支撑位、阻力位或买卖信号。",
  },
  rsi14: {
    title: "RSI 14",
    what: "衡量近期上涨力度与下跌力度相对强弱的动量指标，取值为 0–100。",
    formula: "使用 Wilder 方法平滑最近 14 个交易日的平均涨幅与平均跌幅。",
    read: "70 以上通常称为偏热，30 以下称为偏冷；中间区域用于观察动量强弱变化。",
    caveat: "偏热不等于马上下跌，偏冷也不等于马上反弹；强趋势中可长时间停留在极端区域。",
  },
  rv20: {
    title: "RV20 已实现波动率",
    what: "描述股票过去一段时间实际发生了多大幅度的波动，不判断涨跌方向。",
    formula: "计算最近 20 个交易日对数收益率的样本标准差，再乘以 √252 年化。",
    read: "数值越高，说明近期价格波动越剧烈；适合与隐含波动率比较。",
    caveat: "它只总结过去，不是未来波动率预测，也不是单日预期涨跌幅。",
  },
  atmIv: {
    title: "ATM IV 平值隐含波动率",
    what: "期权价格反推出的市场波动定价，ATM 指行权价最接近当前股价。",
    formula: "取最近到期、最接近平值行权价的可用 Call 与 Put 隐含波动率平均值。",
    read: "与 RV20 对比，可观察期权定价的未来波动是否高于或低于近期实际波动。",
    caveat: "IV 高不等于期权一定贵；财报、期限、偏斜和供需都会影响价格。",
  },
  expectedRange: {
    title: "到期预期区间",
    what: "最近到期期权价格隐含的波动范围，用来观察市场定价了多大幅度的移动。",
    formula: "预期波动 = 最近平值 Call 与 Put 的价格之和；上下沿 = 当前收盘价 ± 预期波动。",
    read: "比较现价、上下沿和关键持仓价位，可以判断某个价位是否超出当前期权定价范围。",
    caveat: "这不是统计置信区间或目标价，价格完全可能落在区间之外。",
  },
  maxPain: {
    title: "最大痛点",
    what: "假设期权在某个行权价到期结算时，全部未平仓期权买方合计内在价值最低的位置。",
    formula: "逐个候选行权价计算全部 Call 与 Put 的到期内在价值乘以未平仓量，取总额最小者。",
    read: "可作为到期持仓结构的集中参考，并与现价距离一起观察。",
    caveat: "它不代表价格会被吸向该处；当前仅在页面覆盖的近价行权价范围内估算。",
  },
  callWall: {
    title: "看涨墙",
    what: "当前期权样本中 Call 未平仓量最大的行权价。",
    formula: "在最近到期 Call 合约中按未平仓量排序，取未平仓量最高的行权价。",
    read: "可观察上方持仓最集中的价位，以及现价距离该位置还有多远。",
    caveat: "它不等于确定阻力位，也无法从公开未平仓量判断持仓者实际多空方向。",
  },
  putWall: {
    title: "看跌墙",
    what: "当前期权样本中 Put 未平仓量最大的行权价。",
    formula: "在最近到期 Put 合约中按未平仓量排序，取未平仓量最高的行权价。",
    read: "可观察下方持仓最集中的价位，以及现价距离该位置还有多远。",
    caveat: "它不等于确定支撑位，也无法从公开未平仓量判断持仓者实际多空方向。",
  },
  putCallOi: {
    title: "Put / Call 未平仓量比",
    what: "比较当前期权样本中 Put 与 Call 未平仓合约数量的比例。",
    formula: "全部 Put 未平仓量之和 ÷ 全部 Call 未平仓量之和。",
    read: "大于 1 表示 Put 持仓数量更多，小于 1 表示 Call 持仓数量更多。",
    caveat: "比例不能直接解释为看空或看多，因为无法识别买方、卖方及组合策略。",
  },
  gammaProxy: {
    title: "Gamma 结构代理",
    what: "用公开期权 Gamma 与未平仓量估算不同期权结构对价格变化敏感度的相对分布。",
    formula: "单合约 Gamma × 未平仓量 × 合约乘数 × 股价² × 1%；页面统一按 Call 为正、Put 为负汇总。",
    read: "正值偏向观察关键位附近的波动收敛，负值偏向警惕突破后的波动放大。",
    caveat: "这不是真实做市商 Gamma；公开数据无法识别持仓者、买卖方向和盘中变化。",
  },
  openInterest: {
    title: "未平仓量（OI）",
    what: "尚未通过平仓、行权或到期结束的期权合约数量。",
    formula: "由数据源按每个到期日、行权价和 Call/Put 类型提供，页面按行权价直接展示。",
    read: "柱越长表示该行权价现有合约越集中，可用于定位持仓密集区域。",
    caveat: "OI 不是当日成交量，也不表示这些合约是净买入、净卖出或新增方向。",
  },
} as const;

export type MetricHelpKey = keyof typeof METRIC_GLOSSARY;

export function MetricHelp({ metric, align = "start" }: { metric: MetricHelpKey; align?: "start" | "end" }) {
  const item = METRIC_GLOSSARY[metric];
  return (
    <details className={`metric-help ${align === "end" ? "align-end" : ""}`}>
      <summary aria-label={`解释：${item.title}`} title={`解释：${item.title}`}>?</summary>
      <div className="metric-help-card">
        <div className="metric-help-title"><span>指标说明</span><strong>{item.title}</strong></div>
        <dl>
          <div><dt>是什么</dt><dd>{item.what}</dd></div>
          <div><dt>怎么算</dt><dd>{item.formula}</dd></div>
          <div><dt>怎么看</dt><dd>{item.read}</dd></div>
          <div><dt>别误解</dt><dd>{item.caveat}</dd></div>
        </dl>
      </div>
    </details>
  );
}

export function MetricLabel({ children, metric, align }: { children: ReactNode; metric: MetricHelpKey; align?: "start" | "end" }) {
  return <div className="metric-label-with-help"><span>{children}</span><MetricHelp metric={metric} align={align} /></div>;
}
