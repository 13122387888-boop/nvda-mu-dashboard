"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

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

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function createPoster(data: SnapshotExportData, detailUrl: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1440;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  ctx.fillStyle = "#080b10";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid(ctx, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, 1080, 0);
  gradient.addColorStop(0, "#57d68d");
  gradient.addColorStop(1, "#4f8cff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, 10);

  ctx.fillStyle = "#57d68d";
  ctx.font = "800 24px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText("EOD RADAR", 64, 74);
  ctx.fillStyle = "#8994a4";
  ctx.font = "600 19px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText("收盘研究 · 条件观察", 64, 108);
  ctx.textAlign = "right";
  ctx.fillText(`股票 ${data.stockDate} · 期权 ${data.optionsDate ?? "暂无"}`, 1016, 83);
  ctx.textAlign = "left";

  ctx.fillStyle = "#57d68d";
  ctx.font = "900 54px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText(data.symbol, 64, 196);
  ctx.fillStyle = "#dce3eb";
  ctx.font = "600 31px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText(data.name, 64, 244);
  ctx.fillStyle = "#f3f6fa";
  ctx.font = "800 116px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText(data.close, 64, 374);
  ctx.fillStyle = data.change.startsWith("-") ? "#f06f78" : "#57d68d";
  ctx.font = "800 38px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText(data.change, 64, 425);

  ctx.fillStyle = "#10151d";
  ctx.fillRect(64, 486, 952, 238);
  ctx.fillStyle = "#57d68d";
  ctx.font = "800 20px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText("今日结论", 92, 530);
  ctx.fillStyle = "#f3f6fa";
  ctx.font = "650 42px Arial, Microsoft YaHei, sans-serif";
  writeWrapped(ctx, data.summary, 92, 590, 896, 59, 3);

  const evidence = [
    ["趋势", data.trend, `RSI14 ${data.rsi}`],
    ["波动定价", data.volatility, `预期区间 ${data.expectedRange}`],
    ["关键价位", `看涨墙 ${data.callWall}`, `看跌墙 ${data.putWall}`],
    ["期权结构", data.gamma, `观察期限 ${data.optionWindow}`],
  ];
  evidence.forEach((card, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 64 + column * 482;
    const y = 752 + row * 194;
    ctx.fillStyle = "#10151d";
    ctx.fillRect(x, y, 470, 178);
    ctx.fillStyle = index === 3 ? "#f0b45c" : "#8994a4";
    ctx.font = "750 18px Arial, Microsoft YaHei, sans-serif";
    ctx.fillText(card[0], x + 24, y + 38);
    ctx.fillStyle = "#f3f6fa";
    ctx.font = "750 27px Arial, Microsoft YaHei, sans-serif";
    writeWrapped(ctx, card[1], x + 24, y + 82, 420, 34, 2);
    ctx.fillStyle = "#8994a4";
    ctx.font = "550 19px Arial, Microsoft YaHei, sans-serif";
    writeWrapped(ctx, card[2], x + 24, y + 139, 420, 25, 2);
  });

  const qrDataUrl = await QRCode.toDataURL(detailUrl, {
    width: 188,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#080b10", light: "#ffffff" },
  });
  const qrImage = await loadImage(qrDataUrl);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(64, 1160, 204, 204);
  ctx.drawImage(qrImage, 72, 1168, 188, 188);
  ctx.fillStyle = "#f3f6fa";
  ctx.font = "750 25px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText("扫码查看完整研究", 304, 1209);
  ctx.fillStyle = "#8994a4";
  ctx.font = "550 19px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText("价格趋势 · 关键距离 · 期权持仓结构", 304, 1252);
  ctx.fillText("eod-radar.vercel.app", 304, 1290);
  ctx.fillStyle = "#657181";
  ctx.font = "500 17px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText("基于公开日终数据的规则观察，数据变化后重新计算。", 304, 1332);
  ctx.fillStyle = "#9aa5b3";
  ctx.font = "700 17px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText("不构成投资建议", 304, 1362);

  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG export failed")), "image/png"));
}

function detailUrlFor(data: SnapshotExportData) {
  const query = typeof window === "undefined" ? "" : window.location.search;
  return `${PUBLIC_ORIGIN}/stocks/${data.symbol}${query}`;
}

export function SnapshotActions({ data }: { data: SnapshotExportData }) {
  const [status, setStatus] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [busy, setBusy] = useState(false);
  const isWechat = () => /MicroMessenger/i.test(navigator.userAgent);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (preview) setPreview(null);
      else setSheetOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [preview]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  const writeLink = async () => {
    try {
      await navigator.clipboard.writeText(detailUrlFor(data));
      return true;
    } catch {
      return false;
    }
  };

  const generate = async () => {
    setBusy(true);
    setStatus("正在生成研究海报…");
    try {
      return await createPoster(data, detailUrlFor(data));
    } finally {
      setBusy(false);
    }
  };

  const showPoster = (blob: Blob, message: string) => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview({ url: URL.createObjectURL(blob), blob });
    setSheetOpen(false);
    setStatus(message);
  };

  const shareWechat = async () => {
    try {
      const blob = await generate();
      const detailUrl = detailUrlFor(data);
      const file = new File([blob], `${data.symbol}-${data.stockDate}-收盘研究.png`, { type: "image/png" });
      if (!isWechat() && navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `${data.symbol} 收盘研究`, text: `${data.summary}\n${detailUrl}`, url: detailUrl });
          setStatus("已交给系统分享面板，可选择微信");
          setSheetOpen(false);
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      const copied = await writeLink();
      showPoster(blob, copied ? "链接已复制；长按海报发送给微信好友" : "长按海报发送给微信好友");
    } catch {
      setStatus("海报生成失败，请稍后重试");
    }
  };

  const shareMoments = async () => {
    try {
      const blob = await generate();
      const copied = await writeLink();
      showPoster(blob, copied ? "链接已复制；保存海报后发布到朋友圈" : "保存海报后发布到朋友圈");
    } catch {
      setStatus("海报生成失败，请稍后重试");
    }
  };

  const downloadBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${data.symbol}-${data.stockDate}-收盘研究.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };

  const savePoster = async () => {
    try {
      const blob = preview?.blob ?? await generate();
      downloadBlob(blob);
      setStatus("研究海报已保存");
      if (!preview) setSheetOpen(false);
    } catch {
      setStatus("海报生成失败，请稍后重试");
    }
  };

  const copyLink = async () => {
    setStatus(await writeLink() ? "详情页链接已复制" : "请复制浏览器地址栏中的链接");
    setSheetOpen(false);
  };

  return (
    <>
      <div className="snapshot-actions" aria-live="polite">
        <button type="button" className="primary" onClick={() => { setStatus(""); setSheetOpen(true); }}>分享研究</button>
        {status && <span>{status}</span>}
      </div>

      {sheetOpen && <div className="share-sheet-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget && !busy) setSheetOpen(false); }}>
        <section className="share-sheet" role="dialog" aria-modal="true" aria-labelledby="share-sheet-title">
          <i className="share-sheet-handle" />
          <div className="share-sheet-heading"><div><span>分享收盘研究</span><h2 id="share-sheet-title">{data.symbol} · {data.stockDate}</h2></div><button type="button" aria-label="关闭分享面板" onClick={() => setSheetOpen(false)} disabled={busy}>×</button></div>
          <div className="share-sheet-grid">
            <button type="button" onClick={shareWechat} disabled={busy}><i className="share-icon wechat"><b /><b /></i><strong>微信好友</strong><small>海报＋详情链接</small></button>
            <button type="button" onClick={shareMoments} disabled={busy}><i className="share-icon moments"><b /></i><strong>朋友圈</strong><small>竖版研究海报</small></button>
            <button type="button" onClick={savePoster} disabled={busy}><i className="share-icon save">↓</i><strong>保存海报</strong><small>含详情页二维码</small></button>
            <button type="button" onClick={copyLink} disabled={busy}><i className="share-icon copy">⧉</i><strong>复制链接</strong><small>直达完整研究</small></button>
          </div>
          <p>{busy ? "正在生成高清研究海报…" : "微信网页无法代替用户选择好友；如无法直接唤起，会自动切换为长按海报分享。"}</p>
        </section>
      </div>}

      {preview && <div className="snapshot-image-preview" role="dialog" aria-modal="true" aria-label="研究海报预览" onClick={(event) => { if (event.target === event.currentTarget) setPreview(null); }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview.url} alt={`${data.symbol} 收盘研究海报`} />
        <p>{status}</p>
        <div><button type="button" className="primary" onClick={() => savePoster()}>保存图片</button><button type="button" onClick={copyLink}>复制链接</button><button type="button" onClick={() => setPreview(null)}>关闭</button></div>
      </div>}
    </>
  );
}
