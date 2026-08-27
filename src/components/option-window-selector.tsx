"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OptionWindow } from "@/lib/services/stock-dashboard-service";

const optionWindows: Array<{ value: OptionWindow; label: string }> = [
  { value: "ALL", label: "全部" },
  { value: "7", label: "7天" },
  { value: "30", label: "30天" },
  { value: "50", label: "50天" },
];

export function OptionWindowSelector({
  symbol,
  selected,
  counts,
}: {
  symbol: string;
  selected: OptionWindow;
  counts: Record<OptionWindow, number>;
}) {
  const router = useRouter();
  const [optimisticSelection, setOptimisticSelection] = useState(selected);
  const [isPending, startTransition] = useTransition();

  const selectWindow = (value: OptionWindow) => {
    if (value === optimisticSelection || counts[value] === 0) return;
    setOptimisticSelection(value);
    const href = value === "ALL" ? `/stocks/${symbol}` : `/stocks/${symbol}?window=${value}`;
    startTransition(() => router.replace(href, { scroll: false }));
  };

  const prefetchWindow = (value: OptionWindow) => {
    if (counts[value] === 0 || value === selected) return;
    const href = value === "ALL" ? `/stocks/${symbol}` : `/stocks/${symbol}?window=${value}`;
    router.prefetch(href);
  };

  return (
    <div className={`expiration-selector ${isPending ? "pending" : ""}`} aria-label="选择期权剩余到期天数">
      <div><span>期权到期日</span><small>切换时保留当前位置，不重新跳回页首</small></div>
      <nav aria-label="期权期限范围">
        {optionWindows.map((item) => {
          const active = item.value === optimisticSelection;
          const disabled = counts[item.value] === 0;
          return (
            <button
              type="button"
              className={active ? "active" : ""}
              aria-pressed={active}
              disabled={disabled || isPending}
              onPointerEnter={() => prefetchWindow(item.value)}
              onFocus={() => prefetchWindow(item.value)}
              onClick={() => selectWindow(item.value)}
              key={item.value}
            >
              <span>{item.label}</span><small>{counts[item.value]} 份合约</small>
            </button>
          );
        })}
      </nav>
      <footer>
        <small>7 / 30 / 50 天指剩余到期天数以内；灰色选项表示当前没有合约。</small>
        <span aria-live="polite">{isPending ? "正在更新期权范围…" : "切换后墙位、OI 与 Gamma 同步更新"}</span>
      </footer>
    </div>
  );
}
