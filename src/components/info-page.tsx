import type { ReactNode } from "react";
import { Footer, Header } from "@/components/site-chrome";

export function InfoPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className="shell">
      <Header />
      <article className="info-page">
        <header>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{intro}</p>
        </header>
        <div className="info-sections">{children}</div>
      </article>
      <Footer />
    </main>
  );
}

