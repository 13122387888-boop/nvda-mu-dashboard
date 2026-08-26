import Link from "next/link";

export function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="wordmark">EOD / RESEARCH</Link>
      <nav className="site-nav" aria-label="Primary">
        <Link href="/stocks/NVDA">NVDA</Link>
        <Link href="/stocks/MU">MU</Link>
        <span className="source-pill">Data source · OnclickMedia</span>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="disclaimer">
      <span>EOD data for research and product validation only.</span>
      <span>Data source: OnclickMedia · Not investment advice.</span>
    </footer>
  );
}
