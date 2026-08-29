import { connection } from "next/server";
import { Footer, Header } from "@/components/site-chrome";
import { StockScanner } from "@/components/stock-scanner";
import { sanitizeError } from "@/lib/env";
import { getStockCards, STOCKS, SUPPORTED_SYMBOLS } from "@/lib/services/stock-dashboard-service";

export default async function Home() {
  await connection();
  let cards;
  try {
    cards = await getStockCards();
  } catch (error) {
    console.error(`[HOME] Stock cards unavailable: ${sanitizeError(error)}`);
    cards = SUPPORTED_SYMBOLS.map((symbol) => ({
      symbol,
      ...STOCKS[symbol],
      close: null,
      dailyChangePct: null,
      trendScore: null,
      trendConfidence: { level: "LOW" as const, label: "低", reason: "等待数据" },
      relativeVolume: null,
      rsi14: null,
      maStructure: "UNAVAILABLE" as const,
      bollinger: { middle: null, upper: null, lower: null, percentB: null, bandwidth: null, bandwidthPercentile: null, state: "UNAVAILABLE" as const, sampleSize: 0 },
      marketStatus: "INSUFFICIENT_DATA",
      gammaRegime: "UNAVAILABLE" as const,
      attention: { label: "等待首次同步", detail: "数据完成后自动生成观察理由", score: 100, tone: "warning" as const },
      dayOverDay: null,
      ivPercentile: { percentile: null, sampleSize: 0, label: "样本积累中" },
      dataDate: null,
    }));
  }
  const newestDate = cards.map((card) => card.dataDate).filter((date): date is string => Boolean(date)).sort().at(-1) ?? "等待同步";

  return (
    <main className="shell">
      <Header />
      <section className="hero home-hero">
        <div className="home-hero-copy">
          <p className="eyebrow">每日收盘结构扫描</p>
          <h1>先看结构，再决定今天研究谁。</h1>
          <p className="hero-copy">
            把趋势、动量、BOLL位置、量能与期权结构放进同一套阅读路径，再进入详情查看完整依据。
          </p>
          <div className="home-reading-path" aria-label="数据状态">
            <span><b>数据</b>最新收盘 {newestDate} · {cards.length} 个标的 · 按趋势分由高到低</span>
          </div>
        </div>
      </section>
      <StockScanner cards={cards} />
      {!cards.some((card) => card.dataDate) && (
        <div className="empty-callout"><b>暂无可用数据。</b><span>请先执行 <code>npm run sync:bootstrap</code>。</span></div>
      )}
      <Footer />
    </main>
  );
}
