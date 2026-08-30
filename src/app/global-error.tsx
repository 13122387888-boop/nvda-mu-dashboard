"use client";

import { useEffect } from "react";
import Link from "next/link";
import "./globals.css";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[APP] Unexpected root error", error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body>
        <main className="shell route-state-shell">
          <section className="route-state" aria-labelledby="global-error-title">
            <title>页面读取遇到问题</title>
            <span className="route-state-code">服务暂时不可用</span>
            <h1 id="global-error-title">页面没有正常加载</h1>
            <p>可以重新读取当前页面，或先返回首页稍后再试。</p>
            <div className="route-state-actions">
              <button type="button" onClick={() => retry()}>重新读取</button>
              <Link href="/">返回首页</Link>
            </div>
            {error.digest && <small>错误编号：{error.digest}</small>}
          </section>
        </main>
      </body>
    </html>
  );
}
