import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Footer, Header } from "@/components/site-chrome";
import { PriceChart } from "@/components/price-chart";
import { MetricLabel } from "@/components/metric-help";
import { TrendScoreExplanation } from "@/components/trend-score-explanation";
import {
  getStockDashboard,
  isSupportedSymbol,
  STOCKS,
} from "@/lib/services/stock-dashboard-service";
import { money, number, percent, STATUS_LABELS } from "@/lib/format";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const symbol = (await params).symbol.toUpperCase();
  return isSupportedSymbol(symbol)
    ? {
        title: symbol + " 收盘观察",
        description:
          STOCKS[symbol].name + "的长桥日终行情、均线、RSI、BOLL与成交量。",
      }
    : {};
}
export default async function StockPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const symbol = (await params).symbol.toUpperCase();
  if (!isSupportedSymbol(symbol)) notFound();
  await connection();
  const data = await getStockDashboard(symbol).catch(() => null);
  if (!data)
    return (
      <main className="shell">
        <Header />
        <div className="detail-empty">
          <h1>暂无长桥数据</h1>
          <Link href="/">返回首页</Link>
        </div>
        <Footer />
      </main>
    );
  const t = data.trend;
  const bands = t.bollinger;
  const conclusion = STATUS_LABELS[data.quote.marketStatus];
  return (
    <main className="shell stock-detail">
      <Header />
      <section className="dashboard-hero">
        <div>
          <Link href="/" className="back-link">
            ← 返回首页
          </Link>
          <p className="eyebrow">
            {symbol} · 长桥日终数据 {data.stockDate}
          </p>
          <h1>{data.name}</h1>
        </div>
        <div className="quote-block">
          <strong>{money(data.quote.close)}</strong>
          <span
            className={
              (data.quote.dailyChangePct ?? 0) >= 0 ? "positive" : "negative"
            }
          >
            {percent(data.quote.dailyChangePct, true)}
          </span>
          <Link href={"/stocks/" + symbol + "/snapshot"}>分享研究链接 ↗</Link>
        </div>
      </section>
      <section className="lb-summary">
        <h2>
          {conclusion} · 趋势分 {t.score ?? "样本不足"}
        </h2>
        <p>
          依据：RSI {number(t.rsi14, 1)} · 成交量为平时的{" "}
          {number(t.relativeVolume, 1)} 倍 ·{" "}
          {bands.percentB === null
            ? "布林带样本不足"
            : bands.percentB >= 1
              ? "价格在布林带上轨外"
              : bands.percentB >= 0.5
                ? "价格在布林带中轨上方"
                : bands.percentB < 0
                  ? "价格在布林带下轨外"
                  : "价格在布林带中轨下方"}
          。
        </p>
        <p>
          接下来观察：价格能否保持当前均线位置，以及后续涨跌是否伴随成交量增加。
        </p>
      </section>
      <section className="section-block">
        <div className="module-heading">
          <strong className="module-number">01</strong>
          <div className="module-copy">
            <h2>价格与成交量</h2>
            <p>这里能看：价格、均线与量能的配合；看不出：明天一定涨还是跌。</p>
          </div>
        </div>
        <div className="chart-panel">
          <PriceChart data={data.priceHistory} />
        </div>
      </section>
      <section className="section-block">
        <div className="module-heading">
          <strong className="module-number">02</strong>
          <div className="module-copy">
            <h2>趋势与近期强弱</h2>
            <p>点击虚线文字查看指标口径。</p>
          </div>
        </div>
        <div className="lb-indicator-grid">
          <article>
            <MetricLabel metric="rsi14">近期强弱 RSI</MetricLabel>
            <strong>{number(t.rsi14, 1)}</strong>
            <meter min={0} max={100} value={t.rsi14 ?? 50} />
            <small>30偏冷 · 50中性 · 70偏热</small>
          </article>
          <article>
            <MetricLabel metric="relativeVolume">成交活跃度</MetricLabel>
            <strong>{number(t.relativeVolume, 2)}×</strong>
            <meter min={0} max={3} value={t.relativeVolume ?? 0} />
            <small>1× 为此前20日平均水平</small>
          </article>
          <article>
            <MetricLabel metric="bollinger">布林带位置</MetricLabel>
            <strong>
              {bands.percentB === null
                ? "—"
                : Math.round(bands.percentB * 100) + "%"}
            </strong>
            <meter min={0} max={1} value={bands.percentB ?? 0.5} />
            <small>
              下轨 {money(bands.lower)} · 上轨 {money(bands.upper)}
            </small>
          </article>
          <article>
            <MetricLabel metric="rv20">近20日实际波动</MetricLabel>
            <strong>{percent(t.rv20)}</strong>
            <small>年化统计值，用于描述过去的波动。</small>
          </article>
        </div>
        <div className="lb-average-grid">
          {(
            [
              ["50日均线", t.ma50],
              ["100日均线", t.ma100],
              ["200日均线", t.ma200],
            ] as const
          ).map(([label, value]) => (
            <article key={label}>
              <MetricLabel metric="movingAverage">{label}</MetricLabel>
              <b>{money(value)}</b>
              <span
                className={
                  value !== null && data.quote.close >= value
                    ? "positive"
                    : "negative"
                }
              >
                {value === null
                  ? "样本不足"
                  : "距现价 " +
                    percent((data.quote.close / value - 1) * 100, true)}
              </span>
            </article>
          ))}
        </div>
        <details className="lb-score-details">
          <summary>趋势分 {t.score ?? "—"} · 查看组成和计算口径</summary>
          {t.breakdown ? (
            <TrendScoreExplanation breakdown={t.breakdown} />
          ) : (
            <p>至少需要两条可用均线。</p>
          )}
        </details>
      </section>
      <Footer />
    </main>
  );
}
