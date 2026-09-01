import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import nextEnv from "@next/env";
import { getPrisma } from "@/lib/db/prisma";
import { SUPPORTED_SYMBOLS } from "@/lib/stocks";
import { parseLongbridgeCandlePayload } from "@/lib/sync/longbridge-candles";
import { importLongbridgeCandleBatch } from "@/lib/sync/longbridge-stock-import";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
let prisma: ReturnType<typeof getPrisma> | null = null;

async function main() {
  const [inputPath] = process.argv.slice(2);
  if (!inputPath) throw new Error("Usage: npm run import:longbridge-plugin -- <candles.json>");

  const text = await readFile(resolve(inputPath), "utf8");
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Longbridge input file is not valid JSON: ${inputPath}`);
  }

  // No database client is touched until the full file has passed validation.
  const batch = parseLongbridgeCandlePayload(payload);
  const received = new Set(batch.series.map((item) => item.symbol));
  const missing = SUPPORTED_SYMBOLS.filter((symbol) => !received.has(symbol));
  if (missing.length) throw new Error(`Longbridge input is incomplete; missing symbols: ${missing.join(", ")}`);
  prisma = getPrisma();
  const result = await importLongbridgeCandleBatch(batch);
  console.info(`[IMPORT] tradeDate=${result.tradeDate} symbols=${result.symbolCount} rows=${result.rowCount}`);
  console.info("[CACHE] Website data may take up to five minutes to reflect this import.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma?.$disconnect());
