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
      marketStatus: "INSUFFICIENT_DATA",
      gammaRegime: "UNAVAILABLE" as const,
      attention: { label: "等待首次同步", detail: "数据完成后自动生成观察理由", score: 100, tone: "warning" as const },
      dataDate: null,
    }));
  }

  return (
    <main className="shell">
      <Header />
      <section className="hero home-hero">
        <p className="eyebrow">美股收盘行情与期权观察</p>
        <h1>{cards.length}只热门股票，先找到今天值得细看的对象。</h1>
        <p className="hero-copy">
          首页只做快速筛选：比较收盘表现、趋势、Gamma 与最重要的关注理由；点击股票后再进入完整研究页。
        </p>
      </section>
      <StockScanner cards={cards} />
      {!cards.some((card) => card.dataDate) && (
        <div className="empty-callout"><b>暂无可用数据。</b><span>请先执行 <code>npm run sync:bootstrap</code>。</span></div>
      )}
      <Footer />
    </main>
  );
}
