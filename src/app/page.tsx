import { connection } from "next/server";
import { Footer, Header } from "@/components/site-chrome";
import { HomeDataRefresh } from "@/components/home-data-refresh";
import { StockScanner } from "@/components/stock-scanner";
import { getStockCards } from "@/lib/services/stock-dashboard-service";
export default async function Home() {
  await connection();
  let cards: Awaited<ReturnType<typeof getStockCards>> = [];
  try {
    cards = await getStockCards();
  } catch (error) {
    console.error(
      "[HOME] Data unavailable",
      error instanceof Error ? error.name : "Error",
    );
  }
  const date = cards
    .map((card) => card.dataDate)
    .filter(Boolean)
    .sort()
    .at(-1);
  return (
    <main className="shell">
      <HomeDataRefresh />
      <Header />
      <section className="hero home-hero">
        <div className="home-hero-copy">
          <p className="eyebrow">每日收盘结构扫描</p>
          <h1>先看结构，再决定今天研究谁。</h1>
          <p className="hero-copy">
            用趋势、RSI、布林带与成交量，快速了解价格处在什么位置。
          </p>
          <div className="home-reading-path">
            <span>
              <b>长桥日终数据</b> {date ?? "等待同步"} · {cards.length} 个标的 ·
              趋势分降序
            </span>
          </div>
        </div>
      </section>
      <StockScanner cards={cards} />
      {!cards.length && (
        <div className="empty-callout">行情暂时无法读取，请稍后重试。</div>
      )}
      <Footer />
    </main>
  );
}
