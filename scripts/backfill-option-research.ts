import nextEnv from "@next/env";
import { getPrisma } from "../src/lib/db/prisma";
import { parseYmd } from "../src/lib/dates";
import { OnclickMediaProvider } from "../src/lib/providers/onclickmedia/onclickmedia-provider";
import type { OptionContractRecord, SupportedSymbol } from "../src/lib/providers/types";
import { SUPPORTED_SYMBOLS } from "../src/lib/stocks";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const prisma = getPrisma();
const provider = new OnclickMediaProvider();

function researchDates(available: string[], count = 10) {
  const descending = [...available].sort().reverse();
  if (!descending.length) return [];
  const selected = descending.slice(0, 2);
  let anchor = selected.at(-1) ?? descending[0];
  for (const date of descending.slice(2)) {
    const elapsed = (parseYmd(anchor).getTime() - parseYmd(date).getTime()) / 86_400_000;
    if (elapsed < 6) continue;
    selected.push(date);
    anchor = date;
    if (selected.length >= count) break;
  }
  return selected.sort();
}

async function store(rows: OptionContractRecord[]) {
  const data = rows.map((row) => ({
    symbol: row.symbol,
    tradeDate: parseYmd(row.tradeDate),
    expiration: parseYmd(row.expiration),
    optionType: row.optionType,
    strike: row.strike,
    contractSymbol: row.contractSymbol,
    contractMultiplier: row.contractMultiplier,
    bid: row.bid,
    ask: row.ask,
    last: row.last,
    volume: row.volume === null ? null : BigInt(row.volume),
    openInterest: row.openInterest === null ? null : BigInt(row.openInterest),
    impliedVolatility: row.impliedVolatility,
    delta: row.delta,
    gamma: row.gamma,
    theta: row.theta,
    vega: row.vega,
    provider: row.provider,
  }));
  for (let index = 0; index < data.length; index += 200) {
    await prisma.optionEod.createMany({ data: data.slice(index, index + 200), skipDuplicates: true });
  }
}

for (const symbol of SUPPORTED_SYMBOLS) {
  const latestAccessible = await provider.getLatestAvailableOptionDate(symbol);
  const available = (await provider.getAvailableOptionDates(symbol)).filter((date) => !latestAccessible || date <= latestAccessible);
  const dates = researchDates(available);
  const existing = await prisma.optionEod.groupBy({ by: ["tradeDate"], where: { symbol } });
  const existingDates = new Set(existing.map((row) => row.tradeDate.toISOString().slice(0, 10)));
  const missing = dates.filter((date) => !existingDates.has(date));
  console.info(`[OPTION HISTORY] ${symbol}: ${missing.length} missing snapshots`);
  for (const date of missing) {
    try {
      const result = await provider.getLatestOptionChain({ symbol: symbol as SupportedSymbol, tradeDate: date });
      await store(result.records);
      console.info(`[OPTION HISTORY] ${symbol} ${date}: ${result.records.length} contracts`);
    } catch (error) {
      console.warn(`[OPTION HISTORY] ${symbol} ${date}: ${error instanceof Error ? error.message : "failed"}`);
    }
  }
}

await prisma.$disconnect();
