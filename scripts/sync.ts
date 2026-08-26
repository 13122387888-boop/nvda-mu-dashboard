import nextEnv from "@next/env";
import { runSync } from "../src/lib/sync/sync-service";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const mode = process.argv[2] === "bootstrap" ? "bootstrap" : "incremental";

try {
  console.info("[SYNC] Trigger: MANUAL");
  const summary = await runSync({ triggerType: "MANUAL", mode });
  console.info(`[DONE] status=${summary.status}`);
  console.info(JSON.stringify(summary, null, 2));
  if (summary.status === "FAILED") process.exitCode = 1;
} catch (error) {
  console.error(`[FAILED] ${error instanceof Error ? error.message : "Unknown sync error"}`);
  process.exitCode = 1;
}
