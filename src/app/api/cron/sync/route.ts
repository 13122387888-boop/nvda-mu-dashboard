import { timingSafeEqual } from "node:crypto";
import { requireServerEnv } from "@/lib/env";
import { runSync } from "@/lib/sync/sync-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = requireServerEnv("CRON_SECRET");
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export async function GET(request: Request) {
  try {
    if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  } catch {
    return Response.json({ error: "Cron is not configured" }, { status: 503 });
  }

  try {
    return Response.json(await runSync({ triggerType: "CRON", mode: "incremental" }));
  } catch {
    return Response.json({ error: "Sync failed" }, { status: 500 });
  }
}
