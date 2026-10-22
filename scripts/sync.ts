import nextEnv from "@next/env";
import { getPrisma } from "@/lib/db/prisma";
import { collectLongbridgeBatch } from "@/lib/providers/longbridge";
import { importLongbridgeCandleBatch } from "@/lib/sync/longbridge-stock-import";
import { sanitizeError } from "@/lib/env";
nextEnv.loadEnvConfig(process.cwd());
try {
  const bootstrap = process.argv[2] === "bootstrap";
  const batch = await collectLongbridgeBatch(bootstrap ? 520 : 30);
  console.log("[IMPORT] 行情已全部校验，正在统一写入并计算指标。");
  const result = await importLongbridgeCandleBatch(batch);
  console.log("[RESULT] " + JSON.stringify(result));
} catch (error) {
  console.error(sanitizeError(error));
  process.exitCode = 1;
} finally {
  await getPrisma().$disconnect();
}
