import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "页面不存在",
};

export default function NotFound() {
  return (
    <main className="shell route-state-shell">
      <section className="route-state" aria-labelledby="not-found-title">
        <span className="route-state-code">404</span>
        <h1 id="not-found-title">没有找到这个页面</h1>
        <p>地址可能已经变更，或者该股票代码暂未加入研究列表。</p>
        <div className="route-state-actions">
          <Link href="/">返回首页</Link>
        </div>
      </section>
    </main>
  );
}
