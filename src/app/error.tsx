"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[APP] Unexpected rendering error", error);
  }, [error]);

  return (
    <main className="shell route-state-shell">
      <section className="route-state" aria-labelledby="route-error-title">
        <span className="route-state-code">暂时无法显示</span>
        <h1 id="route-error-title">页面读取遇到问题</h1>
        <p>可能是网络或数据服务短暂波动。可以先重新读取，仍未恢复时再返回首页。</p>
        <div className="route-state-actions">
          <button type="button" onClick={() => retry()}>重新读取</button>
          <Link href="/">返回首页</Link>
        </div>
        {error.digest && <small>错误编号：{error.digest}</small>}
      </section>
    </main>
  );
}
