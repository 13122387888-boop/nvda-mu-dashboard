import Link from "next/link";
import { STOCKS, SUPPORTED_SYMBOLS } from "@/lib/stocks";

export function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="wordmark">收盘研究 / EOD</Link>
      <nav className="site-nav" aria-label="主导航">
        <Link href="/">首页</Link>
        <details className="stock-menu">
          <summary>股票池 · {SUPPORTED_SYMBOLS.length}</summary>
          <div>
            {SUPPORTED_SYMBOLS.map((symbol) => <Link href={`/stocks/${symbol}`} key={symbol}><b>{symbol}</b><span>{STOCKS[symbol].shortName}</span></Link>)}
          </div>
        </details>
        <span className="source-pill">数据源 · OnclickMedia</span>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="disclaimer">
      <span>收盘数据仅用于研究与产品验证。</span>
      <span>数据源：OnclickMedia · 不构成投资建议。</span>
    </footer>
  );
}
