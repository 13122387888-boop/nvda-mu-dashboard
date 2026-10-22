import nextEnv from "@next/env";
import { getPrisma } from "@/lib/db/prisma";
import { collectLongbridgeBatch } from "@/lib/providers/longbridge";
import { importLongbridgeCandleBatch } from "@/lib/sync/longbridge-stock-import";
import { sanitizeError } from "@/lib/env";
nextEnv.loadEnvConfig(process.cwd());
try {
  const bootstrap = process.argv[2] === "bootstrap";
  const batch = await collectLongbridgeBatch(bootstrap ? 520 : 30);
  const result = await importLongbridgeCandleBatch(batch);
  console.log("[SYNC] Longbridge", result);
} catch (error) {
  console.error(sanitizeError(error));
  process.exitCode = 1;
} finally {
  await getPrisma().$disconnect();
}
