import Link from "next/link";
import { buildObservationChecklist, type ObservationChecklistInput } from "@/lib/indicators/decision-support";
import { money, number, percent } from "@/lib/format";

type GammaRegime = "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNAVAILABLE";

const gammaLabel: Record<GammaRegime, string> = {
  POSITIVE: "正 Gamma",
  NEGATIVE: "负 Gamma",
  NEUTRAL: "中性",
  UNAVAILABLE: "数据不足",
};

function signed(value: number | null, suffix = "") {
  if (value === null || !Number.isFinite(value)) return "暂无对比";
  if (Math.abs(value) < 0.00001) return `持平${suffix}`;
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}${suffix}`;
}

function wallMove(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "暂无对比";
  if (Math.abs(value) < 0.005) return "持平";
  return `${value > 0 ? "上移" : "下移"} ${money(Math.abs(value))}`;
}

export function DailyChangeSummary({ changes }: {
  changes: {
    previousStockDate: string | null;
    previousOptionDate: string | null;
    closePct: number | null;
    rsiDelta: number | null;
    rv20Delta: number | null;
    callWallMove: number | null;
    putWallMove: number | null;
    expectedMovePctDelta: number | null;
    gammaFrom: GammaRegime | null;
    gammaTo: GammaRegime;
  };
}) {
  const gammaChanged = changes.gammaFrom !== null && changes.gammaFrom !== changes.gammaTo;
  return (
    <section className="daily-change" aria-labelledby="daily-change-title">
      <div className="daily-change-heading">
        <div><span>WHAT CHANGED</span><h2 id="daily-change-title">今天发生了什么</h2></div>
        <small>股票对比 {changes.previousStockDate ?? "暂无"} · 期权对比 {changes.previousOptionDate ?? "暂无"}</small>
      </div>
      <div className="daily-change-grid">
        <article><span>收盘变化</span><strong className={changes.closePct !== null && changes.closePct >= 0 ? "positive" : "negative"}>{changes.closePct === null ? "暂无对比" : percent(changes.closePct, true)}</strong><p>相对前一交易日收盘价</p></article>
        <article><span>动量与实际波动</span><strong>RSI {signed(changes.rsiDelta)}</strong><p>RV20 {changes.rv20Delta === null ? "暂无对比" : signed(changes.rv20Delta * 100, " 个百分点")}</p></article>
        <article><span>关键墙位移动</span><strong>看涨墙 {wallMove(changes.callWallMove)}</strong><p>看跌墙 {wallMove(changes.putWallMove)}</p></article>
        <article className={gammaChanged ? "changed" : ""}><span>期权波动结构</span><strong>{changes.gammaFrom === null ? gammaLabel[changes.gammaTo] : gammaChanged ? `${gammaLabel[changes.gammaFrom]} → ${gammaLabel[changes.gammaTo]}` : `维持${gammaLabel[changes.gammaTo]}`}</strong><p>预期波动 {changes.expectedMovePctDelta === null ? "暂无对比" : signed(changes.expectedMovePctDelta * 100, " 个百分点")}</p></article>
      </div>
      <small>仅比较相邻可用日终记录；“暂无对比”表示该到期日尚未积累足够历史。</small>
    </section>
  );
}

export function ObservationChecklist({ input }: { input: ObservationChecklistInput }) {
  const items = buildObservationChecklist(input);
  return (
    <section className="observation-checklist" aria-labelledby="observation-checklist-title">
      <div className="checklist-heading">
        <div><span>TODAY&apos;S WATCHLIST</span><h2 id="observation-checklist-title">今日观察清单</h2></div>
        <p>条件满足后仍需结合趋势与数据日期复核。</p>
      </div>
      <div className="checklist-grid">
        {items.map((item) => (
          <article className={item.tone} key={item.label}>
            <div><span>{item.label}</span><b>{item.status}</b></div>
            <strong>{item.condition}</strong><p>{item.detail}</p>
          </article>
        ))}
      </div>
      <small>清单只说明观察条件是否接近或满足，不代表应当买入、卖出或调整仓位。</small>
    </section>
  );
}

type Position = { value: number | null; percentile: number | null; sampleSize: number };

function positionCopy(percentileValue: number | null, sampleSize: number) {
  if (percentileValue === null) return sampleSize ? `当前仅有 ${sampleSize} 个可比样本` : "暂无可比历史";
  if (percentileValue >= 80) return "处于过去一年偏高区域";
  if (percentileValue <= 20) return "处于过去一年偏低区域";
  return "处于过去一年中间区域";
}

export function HistoricalPosition({ positions }: { positions: { rsi14: Position; rv20: Position; ma20Deviation: Position } }) {
  const items = [
    { label: "RSI 14", display: number(positions.rsi14.value, 1), data: positions.rsi14 },
    { label: "RV20", display: percent(positions.rv20.value), data: positions.rv20 },
    { label: "相对20日均线", display: percent(positions.ma20Deviation.value), data: positions.ma20Deviation },
  ];
  return (
    <section className="historical-position" aria-labelledby="historical-position-title">
      <div className="historical-heading"><div><span>ONE-YEAR CONTEXT</span><h3 id="historical-position-title">当前读数的历史位置</h3></div><p>高低只表示历史排序，不表示好坏。</p></div>
      <div className="historical-grid">
        {items.map((item) => (
          <article key={item.label}>
            <div><span>{item.label}</span><strong>{item.display}</strong></div>
            <div className="percentile-track" aria-label={`${item.label}历史百分位 ${item.data.percentile ?? "样本不足"}`}><i style={{ width: `${item.data.percentile ?? 0}%` }} /></div>
            <b>{item.data.percentile === null ? "样本不足" : `第 ${item.data.percentile} 百分位`}</b>
            <p>{positionCopy(item.data.percentile, item.data.sampleSize)} · {item.data.sampleSize} 个样本</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function expirationLabel(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

export function ExpirationSelector({ symbol, expirations, selected }: { symbol: string; expirations: string[]; selected: string | null }) {
  return (
    <div className="expiration-selector" aria-label="选择期权到期日">
      <div><span>到期日</span><small>切换后全部期权指标同步重算</small></div>
      <nav>
        {expirations.map((expiration, index) => (
          <Link href={`/stocks/${symbol}?expiration=${expiration}`} className={expiration === selected ? "active" : ""} aria-current={expiration === selected ? "page" : undefined} key={expiration}>
            <span>{index === 0 ? "最近" : index === 1 ? "下一个" : "后续"}</span>{expirationLabel(expiration)}
          </Link>
        ))}
      </nav>
      {!expirations.length && <b>暂无可用到期日</b>}
    </div>
  );
}

export function SnapshotLink({ symbol, expiration }: { symbol: string; expiration: string | null }) {
  const query = expiration ? `?expiration=${expiration}` : "";
  return <Link className="snapshot-link" href={`/stocks/${symbol}/snapshot${query}`}>分享研究快照 ↗</Link>;
}
