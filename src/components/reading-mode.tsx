"use client";

import { useEffect, useSyncExternalStore } from "react";

type ReadingMode = "beginner" | "professional";

const STORAGE_KEY = "eod-radar:reading-mode";
const MODE_EVENT = "eod-radar:reading-mode-change";

function applyMode(mode: ReadingMode) {
  document.documentElement.dataset.readingMode = mode;
}

function readMode(): ReadingMode {
  return window.localStorage.getItem(STORAGE_KEY) === "professional" ? "professional" : "beginner";
}

function subscribe(onStoreChange: () => void) {
  const update = () => onStoreChange();
  window.addEventListener("storage", update);
  window.addEventListener(MODE_EVENT, update);
  return () => {
    window.removeEventListener("storage", update);
    window.removeEventListener(MODE_EVENT, update);
  };
}

export function ReadingModeControl() {
  const mode = useSyncExternalStore<ReadingMode>(subscribe, readMode, () => "beginner");

  useEffect(() => {
    applyMode(mode);
  }, [mode]);

  const choose = (next: ReadingMode) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(MODE_EVENT));
  };

  return (
    <section className="reading-mode-control" aria-labelledby="reading-mode-title">
      <div className="reading-mode-heading">
        <div>
          <span>阅读辅助</span>
          <strong id="reading-mode-title">{mode === "beginner" ? "新手模式已开启" : "专业模式"}</strong>
          <small>{mode === "beginner" ? "显示人话翻译和三步观察路径，指标与计算口径不变。" : "保留完整指标，收起新手解释与阅读路径。"}</small>
        </div>
        <div className="reading-mode-switch" role="group" aria-label="切换阅读模式">
          <button type="button" aria-pressed={mode === "beginner"} className={mode === "beginner" ? "active" : ""} onClick={() => choose("beginner")}>新手</button>
          <button type="button" aria-pressed={mode === "professional"} className={mode === "professional" ? "active" : ""} onClick={() => choose("professional")}>专业</button>
        </div>
      </div>
      <div className="beginner-only beginner-glossary" aria-label="常用专业词人话翻译">
        <span><b>趋势分</b>方向强弱打分</span>
        <span><b>IV</b>期权定价里的预估波动</span>
        <span><b>Gamma</b>波动容易被压住还是放大</span>
        <span><b>OI</b>还没结束的期权合约</span>
        <span><b>墙位</b>期权持仓最集中的价位</span>
        <span><b>RSI</b>近期涨跌力度温度计</span>
      </div>
    </section>
  );
}
