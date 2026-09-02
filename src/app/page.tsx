import { connection } from "next/server";
import { Footer, Header } from "@/components/site-chrome";
import { HomeDataRefresh } from "@/components/home-data-refresh";
import { StockScanner } from "@/components/stock-scanner";
import { sanitizeError } from "@/lib/env";
import { getDataHealthSummary, type DataHealthSummary } from "@/lib/services/data-health-service";
import { getStockCards, STOCKS, SUPPORTED_SYMBOLS } from "@/lib/services/stock-dashboard-service";

export default async function Home() {
  await connection();
  let cards;
  let health: DataHealthSummary | null = null;
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
      trendBreakdown: null,
      trendConfidence: { level: "LOW" as const, label: "低", reason: "等待数据" },
      relativeVolume: null,
      rsi14: null,
      maStructure: "UNAVAILABLE" as const,
      bollinger: { middle: null, upper: null, lower: null, percentB: null, bandwidth: null, bandwidthPercentile: null, state: "UNAVAILABLE" as const, sampleSize: 0 },
      marketStatus: "INSUFFICIENT_DATA",
      gammaRegime: "UNAVAILABLE" as const,
      optionFreshness: { status: "UNAVAILABLE" as const, isCurrent: false, stockDate: null, metricsDate: null, snapshotDate: null, ageBusinessDays: null, reason: "当前没有可用的期权快照" },
      attention: { label: "等待首次同步", detail: "数据完成后自动生成观察理由", score: 100, tone: "warning" as const },
      dayOverDay: null,
      ivPercentile: { percentile: null, sampleSize: 0, label: "样本积累中" },
      dataDate: null,
    }));
  }
  try {
    health = await getDataHealthSummary();
  } catch (error) {
    console.error(`[HOME] Data health unavailable: ${sanitizeError(error)}`);
  }
  const newestDate = cards.map((card) => card.dataDate).filter((date): date is string => Boolean(date)).sort().at(-1) ?? "等待同步";

  return (
    <main className="shell">
      <HomeDataRefresh />
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
          {health && <details className={`home-data-health health-${health.status}`}>
            <summary>
              <span><b>自动更新</b>股票 {health.currentStockSymbols}/{health.expectedSymbols} · 期权 {health.optionSymbols}/{health.expectedOptionSymbols} · 期权链有限覆盖</span>
              <em>查看质量说明</em>
            </summary>
            <div className="home-data-health-grid">
              <p><b>更新时间</b><span>美股交易日收盘后自动同步；当前最新收盘为 {health.asOf ?? "暂无"}。</span></p>
              <p><b>股票与指标</b><span>{health.currentStockSymbols}/{health.expectedSymbols} 只股票日期一致，{health.alignedMetricsSymbols}/{health.expectedSymbols} 只指标与股票日期一致。</span></p>
              <p><b>期权覆盖</b><span>当前源提供现价附近的部分行权价，不是完整期权链；墙位、OI、Gamma 与最大痛点均为可见样本估算，可能与富途不同。</span></p>
              <p><b>数据例外</b><span>{health.missingOptionSymbols.length ? `期权同步缺失：${health.missingOptionSymbols.join("、")}` : "可同步期权无缺失"}{health.nonOptionSymbols.length ? `；${health.nonOptionSymbols.join("、")} 未发现上市期权` : ""}{health.limitedStockSourceSymbols.length ? `；${health.limitedStockSourceSymbols.join("、")} 的主股票源不支持，当前沿用已核对的备用日线` : ""}</span></p>
            </div>
          </details>}
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
