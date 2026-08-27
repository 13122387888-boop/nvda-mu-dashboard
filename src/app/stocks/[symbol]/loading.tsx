import { Header } from "@/components/site-chrome";

export default function StockLoading() {
  return (
    <main className="shell dashboard-loading" aria-busy="true" aria-label="正在加载股票研究页面">
      <Header />
      <section><span>正在读取最新日终数据</span><div className="loading-line title" /><div className="loading-line price" /></section>
      <div className="loading-brief"><div className="loading-line" /><div className="loading-line short" /><div className="loading-cards"><i /><i /><i /><i /></div></div>
    </main>
  );
}
