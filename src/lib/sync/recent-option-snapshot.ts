import { dateToYmd, parseYmd } from "@/lib/dates";
import { getPrisma } from "@/lib/db/prisma";
import { isRecentOptionSnapshot } from "@/lib/indicators/options/option-snapshot-freshness";
import type { SupportedSymbol } from "@/lib/stocks";

export async function loadRecentOptionSnapshot(symbol: SupportedSymbol, stockDate: string) {
  const prisma = getPrisma();
  const candidate = await prisma.optionEod.findFirst({
    where: { symbol, tradeDate: { lte: parseYmd(stockDate) } },
    orderBy: { tradeDate: "desc" },
    select: { tradeDate: true },
  });
  if (!candidate) return { tradeDate: null, rows: [] };
  const tradeDate = dateToYmd(candidate.tradeDate);
  if (!isRecentOptionSnapshot(stockDate, tradeDate)) return { tradeDate, rows: [] };
  const rows = await prisma.optionEod.findMany({
    // A lagged snapshot may still contain contracts that expired before the
    // newer stock close. Those contracts must not reappear as open positions.
    where: { symbol, tradeDate: candidate.tradeDate, expiration: { gt: parseYmd(stockDate) } },
    orderBy: [{ expiration: "asc" }, { strike: "asc" }],
  });
  return { tradeDate, rows };
}
