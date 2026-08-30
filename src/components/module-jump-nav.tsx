"use client";

import { useEffect, useState } from "react";
import { money, percent } from "@/lib/format";

const modules = [
  { id: "module-price", index: "01", label: "价格", longLabel: "价格与关键位" },
  { id: "module-momentum", index: "02", label: "近期", longLabel: "近期强弱与波动" },
  { id: "module-options", index: "03", label: "期权", longLabel: "期权持仓与波动" },
] as const;

type ModuleId = (typeof modules)[number]["id"];

export function ModuleJumpNav({
  symbol,
  close,
  dailyChangePct,
  trendScore,
  confidenceLabel,
  optionWindowLabel,
}: {
  symbol: string;
  close: number;
  dailyChangePct: number | null;
  trendScore: number | null;
  confidenceLabel: string;
  optionWindowLabel: string;
}) {
  const [activeId, setActiveId] = useState<ModuleId>(modules[0].id);

  useEffect(() => {
    const elements = modules.map((item) => document.getElementById(item.id)).filter((item): item is HTMLElement => Boolean(item));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveId(visible.target.id as ModuleId);
    }, { rootMargin: "-62px 0px -62%", threshold: [0, 0.08, 0.35] });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const jump = (id: ModuleId) => {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const moduleButtons = (mobile = false) => modules.map((item) => (
    <button
      type="button"
      className={activeId === item.id ? "active" : ""}
      aria-current={activeId === item.id ? "location" : undefined}
      onClick={() => jump(item.id)}
      key={`${mobile ? "mobile" : "desktop"}-${item.id}`}
    >
      <b>{item.index}</b><span>{mobile ? item.label : item.longLabel}</span>
    </button>
  ));

  return (
    <>
      <aside className="stock-context-nav" aria-label={`${symbol} 当前研究上下文`}>
        <div className="stock-context-facts">
          <strong>{symbol}</strong>
          <span>{money(close)}</span>
          <span className={dailyChangePct === null ? "" : dailyChangePct >= 0 ? "positive" : "negative"}>{dailyChangePct === null ? "—" : `${dailyChangePct >= 0 ? "+" : ""}${percent(dailyChangePct, true)}`}</span>
          <span>趋势分 <b>{trendScore ?? "—"}</b></span>
          <span className="context-confidence">趋势数据 {confidenceLabel}</span>
          <span className="context-window">{optionWindowLabel}</span>
        </div>
        <nav className="module-jump-nav" aria-label="研究模块快速导航">{moduleButtons()}</nav>
      </aside>
      <nav className="mobile-module-nav" aria-label="研究模块底部导航">{moduleButtons(true)}</nav>
    </>
  );
}
