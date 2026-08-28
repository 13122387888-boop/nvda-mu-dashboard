"use client";

import { useState } from "react";

export type SnapshotExportData = {
  symbol: string;
  name: string;
  stockDate: string;
  optionsDate: string | null;
  expiration: string | null;
  optionWindow: string;
  close: string;
  change: string;
  summary: string;
  trend: string;
  rsi: string;
  volatility: string;
  expectedRange: string;
  callWall: string;
  putWall: string;
  gamma: string;
};

const PUBLIC_ORIGIN = "https://eod-radar.vercel.app";

function snapshotUrlFor(data: SnapshotExportData) {
  const query = typeof window === "undefined" ? "" : window.location.search;
  return `${PUBLIC_ORIGIN}/stocks/${data.symbol}/snapshot${query}`;
}

function shareText(data: SnapshotExportData) {
  return [
    `${data.symbol} ${data.name}｜${data.stockDate} 收盘研究`,
    data.summary,
    `趋势：${data.trend}｜Gamma：${data.gamma}`,
    `关键价位：看跌墙 ${data.putWall}｜看涨墙 ${data.callWall}`,
  ].join("\n");
}

export function SnapshotActions({ data }: { data: SnapshotExportData }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(snapshotUrlFor(data));
      setStatus("研究链接已复制，可粘贴到微信");
    } catch {
      setStatus("请复制浏览器地址栏中的链接");
    }
  };

  const shareDirectly = async () => {
    if (!navigator.share) {
      await copyLink();
      return;
    }

    setBusy(true);
    setStatus("");
    try {
      await navigator.share({
        title: `${data.symbol} 收盘研究`,
        text: shareText(data),
        url: snapshotUrlFor(data),
      });
      setStatus("分享已完成");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        await copyLink();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="snapshot-actions" aria-live="polite">
      <button type="button" className="primary" onClick={shareDirectly} disabled={busy}>
        {busy ? "正在打开…" : "直接分享"}
      </button>
      <button type="button" onClick={copyLink}>复制链接</button>
      {status && <span>{status}</span>}
    </div>
  );
}
