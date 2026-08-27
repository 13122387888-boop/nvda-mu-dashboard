import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "热门美股收盘研究", template: "%s · 收盘研究" },
  description: "热门美股的收盘行情、趋势、波动率与期权持仓研究看板。",
  openGraph: {
    title: "热门美股收盘研究",
    description: "快速扫描关注理由，再查看价格趋势、波动率与期权持仓依据。",
    type: "website",
    images: [{ url: "/og-v2.jpg", width: 1200, height: 630, alt: "美股收盘研究" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "热门美股收盘研究",
    description: "快速扫描关注理由，再查看价格趋势、波动率与期权持仓依据。",
    images: ["/og-v2.jpg"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
