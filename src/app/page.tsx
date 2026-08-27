import Link from "next/link";
import { connection } from "next/server";
import { Footer, Header } from "@/components/site-chrome";
import { money, percent, STATUS_LABELS } from "@/lib/format";
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
      dataDate: null,
    }));
  }

  return (
    <main className="shell">
      <Header />
      <section className="hero">
        <p className="eyebrow">美股收盘行情与期权观察</p>
        <h1>两只股票，一个清晰可靠的收盘视图。</h1>
        <p className="hero-copy">
          聚焦英伟达与美光科技，把价格趋势、动量、波动率和期权持仓集中在一个页面，并明确展示每项数据的交易日期。
        </p>
      </section>

      <section className="stock-grid" aria-label="关注股票">
        {cards.map((stock) => (
          <Link className="stock-card" href={`/stocks/${stock.symbol}`} key={stock.symbol} style={{ "--accent": stock.accent } as React.CSSProperties}>
            <div className="stock-card-top"><span className="ticker">{stock.symbol}</span><span className="eod-badge">收盘数据</span></div>
            <h2>{stock.name}</h2>
            <div className="price-row">
              <strong>{money(stock.close)}</strong>
              <span className={stock.dailyChangePct !== null && stock.dailyChangePct >= 0 ? "positive" : "negative"}>
                {stock.dailyChangePct === null ? "等待数据同步" : `${stock.dailyChangePct >= 0 ? "+" : ""}${percent(stock.dailyChangePct, true)}`}
              </span>
            </div>
            <div className="card-meta"><span>趋势状态</span><b><i className={`status-dot ${stock.marketStatus.toLowerCase()}`} />{STATUS_LABELS[stock.marketStatus]}</b></div>
            <div className="card-footer"><span>数据日期 · {stock.dataDate ?? "—"}</span><span aria-hidden="true">查看分析 →</span></div>
          </Link>
        ))}
      </section>
      {!cards.some((card) => card.dataDate) && (
        <div className="empty-callout"><b>暂无可用数据。</b><span>请先执行 <code>npm run sync:bootstrap</code>。</span></div>
      )}
      <Footer />
    </main>
  );
}
