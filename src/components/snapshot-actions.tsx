"use client";

import { useState } from "react";
import { SITE_NAME } from "@/lib/site";

export type SnapshotExportData = {
  symbol: string;
  name: string;
  stockDate: string;
  summary: string;
};

function snapshotUrlFor(data: SnapshotExportData) {
  const query = typeof window === "undefined" ? "" : window.location.search;
  const path = `/stocks/${data.symbol}/snapshot${query}`;
  return typeof window === "undefined"
    ? path
    : new URL(path, window.location.origin).toString();
}

function shareText(data: SnapshotExportData) {
  return [
    `${data.symbol} ${data.name}｜${data.stockDate} ${SITE_NAME}`,
    data.summary,
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
        title: `${data.symbol} ${SITE_NAME}`,
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
      <button
        type="button"
        className="primary"
        onClick={shareDirectly}
        disabled={busy}
      >
        {busy ? "正在打开…" : "直接分享"}
      </button>
      <button type="button" onClick={copyLink}>
        复制链接
      </button>
      {status && <span>{status}</span>}
    </div>
  );
}
