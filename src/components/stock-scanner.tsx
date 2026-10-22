"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TrendScoreExplanation } from "./trend-score-explanation";
import { StructureDistribution } from "./structure-distribution";
import { money, percent } from "@/lib/format";
import type { StockCard } from "@/lib/services/stock-dashboard-service";
type Filter = "ALL" | "STOCK" | "ETF" | "STRONG" | "VOLUME" | "SQUEEZE";
const filters: Array<[Filter, string]> = [
  ["ALL", "全部"],
  ["STOCK", "个股"],
  ["ETF", "ETF"],
  ["STRONG", "趋势偏强"],
  ["VOLUME", "成交活跃"],
  ["SQUEEZE", "BOLL收口"],
];
function status(score: number | null) {
  if (score === null) return { label: "样本不足", tone: "neutral" };
  if (score >= 75) return { label: "趋势强势", tone: "positive" };
  if (score >= 60) return { label: "趋势偏强", tone: "positive" };
  if (score >= 40) return { label: "趋势中性", tone: "neutral" };
  return { label: "趋势偏弱", tone: "negative" };
}
export function StockScanner({ cards }: { cards: StockCard[] }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<StockCard | null>(null);
  useEffect(() => {
    if (!selected) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = old;
      window.removeEventListener("keydown", close);
    };
  }, [selected]);
  const visible = cards
    .filter((card) => {
      if (
        search &&
        !(card.symbol + " " + card.name)
          .toLowerCase()
          .includes(search.toLowerCase())
      )
        return false;
      if (filter === "STOCK" || filter === "ETF")
        return card.assetType === filter;
      if (filter === "STRONG") return (card.trendScore ?? 0) >= 60;
      if (filter === "VOLUME") return (card.relativeVolume ?? 0) >= 1.5;
      if (filter === "SQUEEZE") return card.bollinger?.state === "SQUEEZE";
      return true;
    })
    .sort(
      (a, b) =>
        (b.trendScore ?? -1) - (a.trendScore ?? -1) ||
        a.symbol.localeCompare(b.symbol),
    );
  return (
    <section>
      <div className="lb-filter-row" role="group" aria-label="单选筛选">
        {filters.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            className={filter === value ? "active" : ""}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <StructureDistribution cards={visible} />
      <div className="lb-section-title">
        <h2>
          股票清单 <small>{visible.length}</small>
        </h2>
        <input
          aria-label="搜索股票"
          placeholder="代码 / 名称"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="lb-stock-list">
        <div className="lb-stock-row lb-list-heading">
          <span>代码 / 名称</span>
          <span>收盘 / 涨跌</span>
          <span>趋势判断</span>
          <span>RSI / 量能</span>
        </div>
        {visible.map((card) => {
          const s = status(card.trendScore);
          return (
            <div key={card.symbol} className="lb-stock-row">
              <Link href={"/stocks/" + card.symbol} className="lb-stock-name">
                <b style={{ color: card.accent }}>{card.symbol}</b>
                <small>{card.shortName}</small>
              </Link>
              <Link href={"/stocks/" + card.symbol}>
                <b>{money(card.close)}</b>
                <small
                  className={
                    (card.dailyChangePct ?? 0) >= 0 ? "positive" : "negative"
                  }
                >
                  {card.dailyChangePct === null
                    ? "—"
                    : percent(card.dailyChangePct, true)}
                </small>
              </Link>
              <button
                className={"lb-score " + s.tone}
                onClick={() => setSelected(card)}
                aria-label={card.symbol + "趋势分组成"}
              >
                <b>
                  <i />
                  {card.trendScore ?? "—"}
                </b>
                <small>{s.label}</small>
              </button>
              <Link href={"/stocks/" + card.symbol}>
                <b>{card.rsi14?.toFixed(0) ?? "—"}</b>
                <small>量 {card.relativeVolume?.toFixed(1) ?? "—"}×</small>
              </Link>
            </div>
          );
        })}
        {!visible.length && <p className="chart-empty">没有符合条件的标的。</p>}
      </div>
      {selected && (
        <div
          className="metric-note-overlay active"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <section
            className="metric-note-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="趋势分组成"
          >
            <button autoFocus onClick={() => setSelected(null)}>
              关闭
            </button>
            <h2>{selected.symbol} 趋势分组成</h2>
            {selected.trendBreakdown ? (
              <TrendScoreExplanation breakdown={selected.trendBreakdown} />
            ) : (
              <p>{selected.trendConfidence.reason}</p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
