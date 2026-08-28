import { getDataAlignment } from "@/lib/data-alignment";

export function DataAlignmentNotice({ stockDate, optionsDate }: { stockDate: string; optionsDate: string | null }) {
  const alignment = getDataAlignment(stockDate, optionsDate);
  if (alignment.status === "MISSING_OPTIONS") {
    return (
      <aside className="data-alignment-alert missing" role="status">
        <strong><span>!</span>期权数据暂缺</strong>
        <p>当前只能阅读股票价格趋势；看涨墙、看跌墙、Gamma、IV 与预期区间暂不可用。</p>
      </aside>
    );
  }
  if (alignment.status === "ALIGNED") return null;

  const stockIsNewer = alignment.stockIsNewer;
  const laggingLabel = stockIsNewer ? "期权快照较早" : "股票行情较早";

  return (
    <aside className="data-alignment-alert" role="alert">
      <strong><span>!</span>股票与期权日期不一致</strong>
      <div>
        <p><b>股票 {stockDate}</b><i>·</i><b>期权 {optionsDate}</b><em>{laggingLabel}</em></p>
        <small>{stockIsNewer ? "墙位、Gamma、IV 与预期区间来自较早期权快照，不能直接当作最新收盘价下的同步结构。" : "价格趋势来自较早股票行情，需等待股票数据追上后再与期权结构一起判断。"}</small>
      </div>
    </aside>
  );
}
