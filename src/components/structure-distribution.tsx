"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { StockCard } from "@/lib/services/stock-dashboard-service";
import "./structure-distribution.css";

function rsiState(value: number | null) {
  if (value === null) return { tone: "neutral", label: "RSI暂无" };
  if (value >= 70) return { tone: "rsi-hot", label: "RSI偏热" };
  if (value >= 55) return { tone: "rsi-strong", label: "RSI偏强" };
  if (value <= 30) return { tone: "rsi-cold", label: "RSI偏冷" };
  if (value <= 45) return { tone: "rsi-weak", label: "RSI偏弱" };
  return { tone: "neutral", label: "RSI中性" };
}

export function StructureDistribution({ cards }: { cards: StockCard[] }) {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const titleId = useId();
  const expandedTitleId = useId();
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const width = 720;
  const height = cards.length > 32 ? 380 : cards.length > 12 ? 320 : 292;
  const padding = { left: 52, right: 24, top: 30, bottom: 42 };
  const plotted = cards.filter(
    (card) => card.trendScore !== null && card.bollinger?.percentB != null,
  );
  const unavailable = cards.filter(
    (card) => card.trendScore === null || card.bollinger?.percentB == null,
  );
  const dense = plotted.length > 12;
  const veryDense = plotted.length > 32;
  const x = (value: number) =>
    padding.left +
    (Math.max(0, Math.min(100, value)) / 100) *
      (width - padding.left - padding.right);
  const y = (value: number) =>
    padding.top +
    ((120 - Math.max(-20, Math.min(120, value))) / 140) *
      (height - padding.top - padding.bottom);
  const radius = (value: number | null) => {
    if (value === null) return 4;
    const scaled = Math.sqrt(Math.max(0.5, Math.min(2.5, value)));
    return (
      (veryDense ? 9 : dense ? 10 : 12) +
      ((scaled - Math.sqrt(0.5)) / (Math.sqrt(2.5) - Math.sqrt(0.5))) *
        (veryDense ? 6 : dense ? 7 : 8)
    );
  };
  // Keep true coordinates as small anchors; move overlapping bubbles with leader lines.
  const positioned = plotted.reduce<
    Array<{
      card: StockCard;
      anchorX: number;
      anchorY: number;
      cx: number;
      cy: number;
      r: number;
    }>
  >((placed, card) => {
    const anchorX = x(card.trendScore!);
    const anchorY = y(card.bollinger!.percentB! * 100);
    const r = radius(card.relativeVolume);
    let cx = anchorX,
      cy = anchorY;
    for (let attempt = 0; attempt < (veryDense ? 96 : 64); attempt++) {
      const distance =
        attempt === 0 ? 0 : 9 + Math.ceil(attempt / 8) * (veryDense ? 9 : 11);
      const angle = ((attempt % 8) * Math.PI) / 4;
      const candidateX = Math.max(
        padding.left + r,
        Math.min(
          width - padding.right - r,
          anchorX + Math.cos(angle) * distance,
        ),
      );
      const candidateY = Math.max(
        padding.top + r,
        Math.min(
          height - padding.bottom - r,
          anchorY + Math.sin(angle) * distance,
        ),
      );
      if (
        placed.every(
          (point) =>
            Math.hypot(point.cx - candidateX, point.cy - candidateY) >=
            point.r + r + 3,
        )
      ) {
        cx = candidateX;
        cy = candidateY;
        break;
      }
    }
    return [...placed, { card, anchorX, anchorY, cx, cy, r }];
  }, []);
  const selected =
    plotted.find((card) => card.symbol === selectedSymbol) ?? null;
  const closeExpanded = useCallback(() => setExpanded(false), []);
  useEffect(() => {
    if (!expanded) return;
    const old = document.body.style.overflow;
    const trigger = expandButtonRef.current;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeExpanded();
        return;
      }
      if (event.key !== "Tab") return;
      const targets = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]),a[href],[tabindex='0']",
      );
      if (!targets?.length) return;
      const first = targets[0],
        last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = old;
      window.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [expanded, closeExpanded]);
  const legend = () => (
    <div className="distribution-legend">
      {[
        ["rsi-hot", "RSI偏热"],
        ["rsi-strong", "RSI偏强"],
        ["neutral", "中性"],
        ["rsi-weak", "RSI偏弱"],
        ["rsi-cold", "RSI偏冷"],
      ].map(([tone, label]) => (
        <span key={tone}>
          <i className={tone} />
          {label}
        </span>
      ))}
    </div>
  );
  const chart = (focus = false) => (
    <div
      className={
        "distribution-chart" + (focus ? " distribution-focus-plot" : "")
      }
    >
      {plotted.length ? (
        <svg
          viewBox={"0 0 " + width + " " + height}
          role="img"
          aria-label="趋势分、布林位置、RSI状态和相对成交量分布图"
        >
          <rect
            x={padding.left}
            y={padding.top}
            width={width - padding.left - padding.right}
            height={height - padding.top - padding.bottom}
            className="distribution-frame"
          />
          <line
            x1={x(50)}
            x2={x(50)}
            y1={padding.top}
            y2={height - padding.bottom}
            className="distribution-midline"
          />
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={y(50)}
            y2={y(50)}
            className="distribution-midline"
          />
          <text x={padding.left + 10} y={padding.top + 17}>
            弱势结构 · 上轨附近
          </text>
          <text
            x={width - padding.right - 10}
            y={padding.top + 17}
            textAnchor="end"
          >
            强势结构 · 上轨附近
          </text>
          <text x={padding.left + 10} y={height - padding.bottom - 10}>
            弱势结构 · 下轨附近
          </text>
          <text
            x={width - padding.right - 10}
            y={height - padding.bottom - 10}
            textAnchor="end"
          >
            强势结构 · 回踩区域
          </text>
          <text x={padding.left - 9} y={padding.top + 4} textAnchor="end">
            上轨外
          </text>
          <text
            x={padding.left - 9}
            y={height - padding.bottom + 4}
            textAnchor="end"
          >
            下轨外
          </text>
          <text x={padding.left} y={height - 11}>
            趋势分 0
          </text>
          <text x={width - padding.right} y={height - 11} textAnchor="end">
            趋势分 100
          </text>
          <text
            x="12"
            y={height / 2}
            transform={"rotate(-90 12 " + height / 2 + ")"}
            textAnchor="middle"
            className="distribution-axis-label"
          >
            BOLL位置
          </text>
          {positioned.map(({ card, anchorX, anchorY, cx, cy, r }) => {
            const displaced = Math.hypot(anchorX - cx, anchorY - cy) > 2;
            const active = selectedSymbol === card.symbol;
            return (
              <a
                key={card.symbol}
                href={"/stocks/" + card.symbol}
                className={
                  "distribution-point " +
                  rsiState(card.rsi14).tone +
                  (active ? " selected" : "")
                }
                aria-label={
                  card.symbol +
                  " 趋势分 " +
                  card.trendScore +
                  "，BOLL位置 " +
                  (card.bollinger!.percentB! * 100).toFixed(0) +
                  "%，相对成交量 " +
                  (card.relativeVolume?.toFixed(1) ?? "暂无") +
                  "倍"
                }
                onClick={(event) => {
                  if (!active) {
                    event.preventDefault();
                    setSelectedSymbol(card.symbol);
                  }
                }}
              >
                <title>{card.symbol + " · " + card.shortName}</title>
                {displaced && (
                  <>
                    <line
                      x1={anchorX}
                      y1={anchorY}
                      x2={cx}
                      y2={cy}
                      className="distribution-connector"
                    />
                    <circle
                      cx={anchorX}
                      cy={anchorY}
                      r="2.5"
                      className="distribution-anchor"
                    />
                  </>
                )}
                <circle cx={cx} cy={cy} r={r} />
                <text x={cx} y={cy + 3} textAnchor="middle">
                  {card.symbol}
                </text>
              </a>
            );
          })}
        </svg>
      ) : (
        <div className="distribution-empty">
          当前筛选下缺少可比较的历史数据。
        </div>
      )}
    </div>
  );
  const readout = () => (
    <div
      className={"distribution-readout" + (selected ? " active" : "")}
      aria-live="polite"
    >
      {selected ? (
        <>
          <div>
            <b>{selected.symbol}</b>
            <span>{selected.shortName}</span>
            <span>趋势 {selected.trendScore}</span>
            <span>
              {rsiState(selected.rsi14).label} {selected.rsi14?.toFixed(0)}
            </span>
            <span>
              BOLL位置 {(selected.bollinger!.percentB! * 100).toFixed(0)}%
            </span>
            <span>量能 {selected.relativeVolume?.toFixed(1) ?? "—"}×</span>
          </div>
          <Link href={"/stocks/" + selected.symbol}>查看详情 →</Link>
        </>
      ) : (
        <span>点击气泡查看完整读数；再次点击同一气泡进入详情。</span>
      )}
    </div>
  );
  const footer = (
    <>
      <span>横轴＝趋势分 · 纵轴＝BOLL位置 · 气泡大小＝量能 · 颜色＝RSI</span>
      <span>
        已绘制 {plotted.length}/{cards.length}
        {unavailable.length
          ? " · 样本不足：" + unavailable.map((card) => card.symbol).join("、")
          : ""}
      </span>
    </>
  );
  return (
    <section className="structure-distribution" aria-labelledby={titleId}>
      <div className="distribution-heading">
        <div>
          <span>横向比较</span>
          <h2 id={titleId}>结构分布</h2>
        </div>
        <div className="distribution-heading-tools">
          <div className="distribution-heading-actions">
            <button
              ref={expandButtonRef}
              type="button"
              className="distribution-expand-button"
              aria-haspopup="dialog"
              aria-expanded={expanded}
              onClick={() => setExpanded(true)}
            >
              <span aria-hidden="true">↗</span> 放大查看
            </button>
          </div>
          {legend()}
        </div>
      </div>
      {chart()}
      {readout()}
      <footer>{footer}</footer>
      {expanded &&
        createPortal(
          <div
            className="distribution-focus-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget) closeExpanded();
            }}
          >
            <section
              ref={dialogRef}
              className="distribution-focus-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby={expandedTitleId}
            >
              <header className="distribution-focus-header">
                <div>
                  <span>放大研究视图</span>
                  <h2 id={expandedTitleId}>结构分布 · 放大查看</h2>
                  <p>点击气泡查看读数；气泡有避让偏移时，细线连接实际坐标。</p>
                </div>
                <div className="distribution-focus-actions">
                  <button
                    ref={closeButtonRef}
                    className="distribution-focus-close"
                    type="button"
                    onClick={closeExpanded}
                  >
                    关闭
                  </button>
                </div>
              </header>
              {legend()}
              {chart(true)}
              {readout()}
              <footer>{footer}</footer>
            </section>
          </div>,
          document.body,
        )}
    </section>
  );
}
