import type { SupportedSymbol } from "@/lib/stocks";

export const EVENT_CALENDAR_VERIFIED_AT = "2026-08-28";

type CalendarEvent = {
  date: string;
  label: string;
  detail: string;
};

const COMPANY_EVENTS: Partial<Record<SupportedSymbol, CalendarEvent>> = {
  MU: { date: "2026-10-01", label: "2026财年Q4业绩", detail: "美东 09/30 · 盘后" },
};

const MACRO_EVENTS: CalendarEvent[] = [
  { date: "2026-09-04", label: "美国非农就业", detail: "北京时间 20:30" },
  { date: "2026-09-11", label: "美国 CPI", detail: "北京时间 20:30" },
  { date: "2026-09-17", label: "美联储利率展望", detail: "北京时间 02:00" },
];

function todayInShanghai() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function daysUntil(today: string, date: string) {
  return Math.ceil((new Date(`${date}T00:00:00.000Z`).getTime() - new Date(`${today}T00:00:00.000Z`).getTime()) / 86_400_000);
}

export function countdownLabel(days: number | null) {
  if (days === null) return "待确认";
  if (days < 0) return "已结束";
  if (days === 0) return "今天";
  if (days === 1) return "明日";
  return `${days}天`;
}

export function getEventWindow(input: { symbol: SupportedSymbol; assetType: "STOCK" | "ETF"; optionsExpiration: string | null }) {
  const today = todayInShanghai();
  const company = COMPANY_EVENTS[input.symbol];
  const macro = MACRO_EVENTS.find((event) => event.date >= today) ?? null;
  const optionsDate = input.optionsExpiration && input.optionsExpiration >= today ? input.optionsExpiration : null;
  return {
    today,
    verifiedAt: EVENT_CALENDAR_VERIFIED_AT,
    company: input.assetType === "ETF"
      ? { status: "ETF" as const, label: "ETF 无公司财报", detail: "关注主要成分股与宏观事件", date: null, days: null }
      : company && company.date >= today
        ? { status: "CONFIRMED" as const, ...company, days: daysUntil(today, company.date) }
        : { status: "PENDING" as const, label: "财报日期待确认", detail: "仅展示已确认事件，不使用历史节奏估算", date: null, days: null },
    macro: macro ? { status: "CONFIRMED" as const, ...macro, days: daysUntil(today, macro.date) }
      : { status: "STALE" as const, label: "宏观日历待更新", detail: "已核验事件窗口已结束", date: null, days: null },
    options: optionsDate
      ? { status: "CONFIRMED" as const, label: "最近定价到期日", detail: optionsDate, date: optionsDate, days: daysUntil(today, optionsDate) }
      : { status: "PENDING" as const, label: "期权到期日暂无", detail: "当前范围没有可用定价到期日", date: null, days: null },
  };
}
