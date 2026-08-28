import { countdownLabel, getEventWindow } from "@/lib/event-calendar";
import type { SupportedSymbol } from "@/lib/stocks";

export function EventWindow({ symbol, assetType, optionsExpiration }: { symbol: SupportedSymbol; assetType: "STOCK" | "ETF"; optionsExpiration: string | null }) {
  const events = getEventWindow({ symbol, assetType, optionsExpiration });
  const cards = [
    { kicker: "公司", ...events.company },
    { kicker: "宏观", ...events.macro },
    { kicker: "期权", ...events.options },
  ];
  const confirmed = cards.filter((card) => card.status === "CONFIRMED").sort((a, b) => (a.days ?? 999) - (b.days ?? 999));
  const nearest = confirmed[0];
  return <section className="event-window" aria-labelledby="event-window-title">
    <div className="event-window-heading"><div><span>风险日历</span><h2 id="event-window-title">事件窗口</h2></div><small>只列已确认日期；临近事件不代表涨跌方向</small></div>
    <div className="event-window-grid">{cards.map((card) => <article className={card === nearest ? "nearest" : card.status.toLowerCase()} key={card.kicker}><span>{card.kicker}</span><strong>{card.label}</strong><p>{card.detail}</p><b>{countdownLabel(card.days)}</b></article>)}</div>
    <footer>公司与宏观事件：长桥财务日历 · {events.verifiedAt} 核验；期权到期：当前 OnclickMedia 日终期权链。</footer>
  </section>;
}
