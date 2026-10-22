// Collection runs on the trusted machine with Longbridge CLI installed.
// This endpoint only invalidates read caches after a successful import.
import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { requireServerEnv } from "@/lib/env";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const expected = Buffer.from(requireServerEnv("CRON_SECRET"));
  const supplied = Buffer.from(
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "",
  );
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  revalidateTag("stock-dashboard", { expire: 0 });
  return Response.json({ source: "LONGBRIDGE", cache: "refreshed" });
}
