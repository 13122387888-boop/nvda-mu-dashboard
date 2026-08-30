import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { SITE_NAME, SITE_NAME_EN } from "@/lib/site";
import { getSiteOrigin } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteOrigin = getSiteOrigin();

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  applicationName: `${SITE_NAME} ${SITE_NAME_EN}`,
  title: { default: `${SITE_NAME}｜热门美股日终研究`, template: `%s · ${SITE_NAME}` },
  description: "热门美股的收盘行情、趋势、波动率与期权持仓研究看板。",
  alternates: { canonical: "/" },
  openGraph: {
    title: `${SITE_NAME}｜热门美股日终研究`,
    description: "快速扫描关注理由，再查看价格趋势、波动率与期权持仓依据。",
    type: "website",
    siteName: `${SITE_NAME} ${SITE_NAME_EN}`,
    url: "/",
    images: [{ url: "/og-v2.jpg", width: 1200, height: 630, alt: `${SITE_NAME}美股日终研究` }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME}｜热门美股日终研究`,
    description: "快速扫描关注理由，再查看价格趋势、波动率与期权持仓依据。",
    images: ["/og-v2.jpg"],
  },
};

export const viewport: Viewport = { viewportFit: "cover" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
