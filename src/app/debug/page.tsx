import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Footer, Header } from "@/components/site-chrome";
import { loadDataHealthSummary } from "@/lib/services/data-health-service";
export default async function DebugPage() {
  if (process.env.ENABLE_DEBUG_PAGE !== "true") notFound();
  await connection();
  const health = await loadDataHealthSummary();
  return (
    <main className="shell">
      <Header />
      <h1>长桥数据状态</h1>
      <p>
        {health.asOf} · {health.currentStockSymbols}/{health.expectedSymbols}
      </p>
      <pre>{JSON.stringify(health, null, 2)}</pre>
      <Footer />
    </main>
  );
}
