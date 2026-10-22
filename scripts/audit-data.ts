import nextEnv from "@next/env";
import { getPrisma } from "@/lib/db/prisma";
import { SUPPORTED_SYMBOLS } from "@/lib/stocks";
import { dateToYmd } from "@/lib/dates";
nextEnv.loadEnvConfig(process.cwd());
const prisma = getPrisma();
try {
  const rows = [];
  for (const symbol of SUPPORTED_SYMBOLS) {
    const [count, latest, metrics] = await Promise.all([
      prisma.stockDaily.count({ where: { symbol, provider: "LONGBRIDGE" } }),
      prisma.stockDaily.findFirst({
        where: { symbol, provider: "LONGBRIDGE" },
        orderBy: { tradeDate: "desc" },
      }),
      prisma.stockMetrics.findFirst({
        where: { symbol },
        orderBy: { tradeDate: "desc" },
      }),
    ]);
    rows.push({
      symbol,
      count,
      date: latest ? dateToYmd(latest.tradeDate) : null,
      metricsDate: metrics ? dateToYmd(metrics.tradeDate) : null,
    });
  }
  console.table(rows);
  const dates = new Set(rows.map((row) => row.date));
  if (
    dates.has(null) ||
    dates.size !== 1 ||
    rows.some((row) => row.date !== row.metricsDate)
  )
    throw new Error("Longbridge stocks/metrics are incomplete or misaligned");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Audit failed");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
