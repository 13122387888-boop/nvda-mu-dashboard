import Link from "next/link";
import { SITE_CONTACT_EMAIL, SITE_NAME, SITE_NAME_EN } from "@/lib/site";
import { STOCKS, SUPPORTED_SYMBOLS } from "@/lib/stocks";

export function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="wordmark">{SITE_NAME} / {SITE_NAME_EN.toUpperCase()}</Link>
      <nav className="site-nav" aria-label="主导航">
        <Link href="/">首页</Link>
        <details className="stock-menu">
          <summary>全部标的</summary>
          <div>
            {SUPPORTED_SYMBOLS.map((symbol) => <Link href={`/stocks/${symbol}`} key={symbol}><b>{symbol}</b><span>{STOCKS[symbol].shortName}</span></Link>)}
          </div>
        </details>
        <span className="source-pill">数据源 · OnclickMedia + 长桥</span>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="disclaimer">
      <div className="footer-copy">
        <span>邀请测试 · 页面根据日终数据整理，仅供研究参考，不构成投资建议。</span>
        <span>数据源：OnclickMedia + 长桥历史补充</span>
      </div>
      <nav className="footer-links" aria-label="产品说明">
        <Link href="/methodology">数据与方法</Link>
        <Link href="/privacy">隐私说明</Link>
        <Link href="/terms">使用条款</Link>
        <a href={`mailto:${SITE_CONTACT_EMAIL}?subject=${encodeURIComponent(`${SITE_NAME}问题反馈`)}`}>问题反馈</a>
      </nav>
    </footer>
  );
}
