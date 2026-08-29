import { connection } from "next/server";
import { Footer, Header } from "@/components/site-chrome";
import { StockScanner } from "@/components/stock-scanner";
import { getStockCards, STOCKS, SUPPORTED_SYMBOLS } from "@/lib/services/stock-dashboard-service";

export default async function Home() {
  await connection();
  let cards;
  try {
    cards = await getStockCards();
  } catch {
    cards = SUPPORTED_SYMBOLS.map((symbol) => ({
      symbol,
      ...STOCKS[symbol],
      close: null,
      dailyChangePct: null,
      trendScore: null,
      trendConfidence: { level: "LOW" as const, label: "低", reason: "等待数据" },
      relativeVolume: null,
      marketStatus: "INSUFFICIENT_DATA",
      gammaRegime: "UNAVAILABLE" as const,
      attention: { label: "等待首次同步", detail: "数据完成后自动生成观察理由", score: 100, tone: "warning" as const },
      dayOverDay: null,
      ivPercentile: { percentile: null, sampleSize: 0, label: "样本积累中" },
      dataDate: null,
    }));
  }
  const newestDate = cards.map((card) => card.dataDate).filter((date): date is string => Boolean(date)).sort().at(-1) ?? "等待同步";
  const comparableCount = cards.filter((card) => card.dayOverDay?.previousStockDate).length;

  return (
    <main className="shell">
      <Header />
      <section className="hero home-hero">
        <div className="home-hero-copy">
          <p className="eyebrow">每日收盘结构扫描</p>
          <h1>先看变化，再决定今天研究谁。</h1>
          <p className="hero-copy">
            把价格趋势和期权结构放在同一张清单里。先看相较上一交易日发生了什么，再进入详情查看依据。
          </p>
          <div className="home-reading-path" aria-label="数据状态">
            <span><b>数据</b>最新收盘 {newestDate} · {cards.length} 个标的 · {comparableCount} 个有昨日对比</span>
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
