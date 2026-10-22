// History and daily refresh share the same collector, validation and atomic importer.
import nextEnv from "@next/env";
import { getPrisma } from "@/lib/db/prisma";
import { collectLongbridgeBatch } from "@/lib/providers/longbridge";
import { importLongbridgeCandleBatch } from "@/lib/sync/longbridge-stock-import";
import { sanitizeError } from "@/lib/env";
nextEnv.loadEnvConfig(process.cwd());
try {
  console.log(
    await importLongbridgeCandleBatch(await collectLongbridgeBatch(520)),
  );
} catch (error) {
  console.error(sanitizeError(error));
  process.exitCode = 1;
} finally {
  await getPrisma().$disconnect();
}
