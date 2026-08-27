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
  title: { default: "NVDA + MU 收盘研究", template: "%s · 收盘研究" },
  description: "英伟达与美光科技的美股收盘行情、趋势指标与期权持仓研究看板。",
  openGraph: {
    title: "NVDA + MU 收盘研究",
    description: "集中查看价格趋势、动量、波动率与期权持仓，并明确标注数据日期。",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "NVDA + MU EOD Research" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "NVDA + MU 收盘研究",
    description: "集中查看价格趋势、动量、波动率与期权持仓，并明确标注数据日期。",
    images: ["/og.png"],
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
