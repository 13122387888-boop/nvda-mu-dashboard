import nextEnv from "@next/env";
import { getPrisma } from "../src/lib/db/prisma";
import { dateToYmd } from "../src/lib/dates";
import { SUPPORTED_SYMBOLS } from "../src/lib/stocks";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const prisma = getPrisma();
const yearStart = new Date(`${new Date().getUTCFullYear()}-01-01T00:00:00.000Z`);

const rows = await Promise.all(SUPPORTED_SYMBOLS.map(async (symbol) => {
  const [total, currentYear, range, latestStock, latestOption, latestMetrics] = await Promise.all([
    prisma.stockDaily.count({ where: { symbol } }),
    prisma.stockDaily.count({ where: { symbol, tradeDate: { gte: yearStart } } }),
    prisma.stockDaily.aggregate({ where: { symbol, tradeDate: { gte: yearStart } }, _min: { tradeDate: true }, _max: { tradeDate: true } }),
    prisma.stockDaily.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" }, select: { tradeDate: true, close: true, provider: true } }),
    prisma.optionEod.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" }, select: { tradeDate: true } }),
    prisma.stockMetrics.findFirst({ where: { symbol }, orderBy: { tradeDate: "desc" }, select: { tradeDate: true } }),
  ]);
  return {
    symbol,
    totalRows: total,
    currentYearRows: currentYear,
    currentYearRange: range._min.tradeDate && range._max.tradeDate ? `${dateToYmd(range._min.tradeDate)} → ${dateToYmd(range._max.tradeDate)}` : "—",
    latestClose: latestStock ? `${Number(latestStock.close).toFixed(2)} · ${latestStock.provider}` : "—",
    latestOptionDate: latestOption ? dateToYmd(latestOption.tradeDate) : "—",
    latestMetricsDate: latestMetrics ? dateToYmd(latestMetrics.tradeDate) : "—",
  };
}));

console.table(rows);
await prisma.$disconnect();
