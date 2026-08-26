import { getPrisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prisma = getPrisma();
    await prisma.$queryRawUnsafe("SELECT 1");
    const latest = await prisma.syncRun.findFirst({ orderBy: { startedAt: "desc" }, select: { completedAt: true, startedAt: true } });
    return Response.json({
      status: "ok",
      database: "connected",
      latestSync: latest?.completedAt?.toISOString() ?? latest?.startedAt.toISOString() ?? null,
    });
  } catch {
    return Response.json({ status: "error", database: "unavailable", latestSync: null }, { status: 503 });
  }
}
