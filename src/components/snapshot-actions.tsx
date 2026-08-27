"use client";

import { useEffect, useState } from "react";

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

function writeWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const chars = [...text];
  let line = "";
  let lineNumber = 0;
  for (const char of chars) {
    const next = line + char;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineNumber * lineHeight);
      line = char;
      lineNumber += 1;
      if (lineNumber >= maxLines - 1) break;
    } else {
      line = next;
    }
  }
  if (lineNumber < maxLines) ctx.fillText(line, x, y + lineNumber * lineHeight);
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.strokeStyle = "rgba(255,255,255,.035)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
  for (let y = 0; y <= height; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
}

async function createSnapshot(data: SnapshotExportData) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#080b10";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid(ctx, canvas.width, canvas.height);
  ctx.fillStyle = "#57d68d";
  ctx.fillRect(0, 0, 8, canvas.height);

  ctx.fillStyle = "#8994a4";
  ctx.font = "700 18px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText("收盘研究 / EOD RESEARCH SNAPSHOT", 58, 56);
  ctx.textAlign = "right";
  ctx.fillText(`股票 ${data.stockDate} · 期权 ${data.optionsDate ?? "暂无"}`, 1144, 56);
  ctx.textAlign = "left";

  ctx.fillStyle = "#57d68d";
  ctx.font = "800 27px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText(data.symbol, 58, 111);
  ctx.fillStyle = "#f3f6fa";
  ctx.font = "600 27px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText(data.name, 155, 111);
  ctx.font = "700 62px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText(data.close, 58, 185);
  ctx.fillStyle = data.change.startsWith("-") ? "#ff6b78" : "#57d68d";
  ctx.font = "700 25px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText(data.change, 330, 181);

  ctx.fillStyle = "#f3f6fa";
  ctx.font = "600 31px Arial, Microsoft YaHei, sans-serif";
  writeWrapped(ctx, data.summary, 58, 246, 1080, 45, 2);

  const cards = [
    ["趋势", data.trend, `RSI ${data.rsi}`],
    ["波动定价", data.volatility, `预期区间 ${data.expectedRange}`],
    ["关键价位", `看涨墙 ${data.callWall}`, `看跌墙 ${data.putWall}`],
    ["期权结构", data.gamma, `期限 ${data.optionWindow} · 定价 ${data.expiration ?? "暂无"}`],
  ];
  const cardWidth = 260;
  cards.forEach((card, index) => {
    const x = 58 + index * 278;
    const y = 354;
    ctx.fillStyle = "#10151d";
    ctx.fillRect(x, y, cardWidth, 164);
    ctx.fillStyle = index === 3 ? "#f0b45c" : "#8994a4";
    ctx.font = "700 16px Arial, Microsoft YaHei, sans-serif";
    ctx.fillText(card[0], x + 18, y + 32);
    ctx.fillStyle = "#f3f6fa";
    ctx.font = "700 23px Arial, Microsoft YaHei, sans-serif";
    writeWrapped(ctx, card[1], x + 18, y + 73, cardWidth - 36, 30, 2);
    ctx.fillStyle = "#8994a4";
    ctx.font = "500 16px Arial, Microsoft YaHei, sans-serif";
    writeWrapped(ctx, card[2], x + 18, y + 132, cardWidth - 36, 22, 2);
  });

  ctx.fillStyle = "#657181";
  ctx.font = "500 15px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText("基于公开日终数据的规则观察 · 数据变化后重新计算 · 不构成投资建议", 58, 580);
  ctx.textAlign = "right";
  ctx.fillText("nvda-mu-dashboard.vercel.app", 1144, 580);
  ctx.textAlign = "left";

  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG export failed")), "image/png"));
}

export function SnapshotActions({ data }: { data: SnapshotExportData }) {
  const [status, setStatus] = useState("");
  const [showWechatGuide, setShowWechatGuide] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isWechat = () => /MicroMessenger/i.test(navigator.userAgent);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("链接已复制");
    } catch {
      setStatus("请复制浏览器地址栏中的链接");
    }
  };
  const shareLink = async () => {
    if (isWechat()) {
      setShowWechatGuide(true);
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: `${data.symbol} 收盘研究快照`, text: data.summary, url: window.location.href });
        setStatus("分享面板已打开");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copyLink();
  };
  const saveImage = async () => {
    setStatus("正在生成图片…");
    try {
      const blob = await createSnapshot(data);
      const file = new File([blob], `${data.symbol}-${data.stockDate}-研究快照.png`, { type: "image/png" });
      if (isWechat()) {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        setStatus("长按图片可保存或发送给朋友");
        return;
      }
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${data.symbol} 收盘研究快照`, text: data.summary });
        setStatus("快照已分享");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
      setStatus("图片已保存");
    } catch {
      setStatus("生成失败，请稍后重试");
    }
  };
  return (
    <>
      <div className="snapshot-actions" aria-live="polite">
        <button type="button" className="primary" onClick={shareLink}>微信分享</button>
        <button type="button" onClick={saveImage}>保存分享图片</button>
        <button type="button" onClick={copyLink}>复制链接</button>
        <button type="button" onClick={() => window.print()}>打印 / PDF</button>
        {status && <span>{status}</span>}
      </div>
      {showWechatGuide && <div className="wechat-share-guide" role="dialog" aria-modal="true" onClick={() => setShowWechatGuide(false)}>
        <div><b>点击右上角 ···</b><span>选择“发送给朋友”或“分享到朋友圈”</span><small>点击任意位置关闭提示</small></div>
      </div>}
      {previewUrl && <div className="snapshot-image-preview" role="dialog" aria-modal="true" onClick={(event) => { if (event.target === event.currentTarget) setPreviewUrl(null); }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt={`${data.symbol} 研究快照分享图片`} />
        <p>长按图片保存或发送给朋友</p>
        <button type="button" onClick={() => setPreviewUrl(null)}>关闭</button>
      </div>}
    </>
  );
}
