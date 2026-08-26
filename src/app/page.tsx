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
        <p className="eyebrow">US EQUITY OPTIONS MONITOR</p>
        <h1>Two names. One reliable EOD view.</h1>
        <p className="hero-copy">
          A focused product-validation dashboard for NVIDIA and Micron, built around transparent stock and options data dates.
        </p>
      </section>

      <section className="stock-grid" aria-label="Tracked stocks">
        {cards.map((stock) => (
          <Link className="stock-card" href={`/stocks/${stock.symbol}`} key={stock.symbol} style={{ "--accent": stock.accent } as React.CSSProperties}>
            <div className="stock-card-top"><span className="ticker">{stock.symbol}</span><span className="eod-badge">EOD</span></div>
            <h2>{stock.name}</h2>
            <div className="price-row">
              <strong>{money(stock.close)}</strong>
              <span className={stock.dailyChangePct !== null && stock.dailyChangePct >= 0 ? "positive" : "negative"}>
                {stock.dailyChangePct === null ? "Awaiting Supabase sync" : `${stock.dailyChangePct >= 0 ? "+" : ""}${percent(stock.dailyChangePct, true)}`}
              </span>
            </div>
            <div className="card-meta"><span>Market status</span><b>{STATUS_LABELS[stock.marketStatus]}</b></div>
            <div className="card-footer"><span>Data date · {stock.dataDate ?? "—"}</span><span aria-hidden="true">View dashboard →</span></div>
          </Link>
        ))}
      </section>
      {!cards.some((card) => card.dataDate) && (
        <div className="empty-callout"><b>No data available.</b><span>Run <code>npm run sync:bootstrap</code> first.</span></div>
      )}
      <Footer />
    </main>
  );
}
