"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OptionWindow } from "@/lib/services/stock-dashboard-service";

const optionWindows: Array<{ value: OptionWindow; label: string }> = [
  { value: "ALL", label: "全部" },
  { value: "7", label: "7天内" },
  { value: "30", label: "30天内" },
  { value: "50", label: "50天内" },
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
    <div className={`expiration-selector ${isPending ? "pending" : ""}`} aria-label="选择统计哪些到期日的期权" aria-busy={isPending}>
      <span className="expiration-label">统计期限</span>
      <nav aria-label="期权到期范围">
        {optionWindows.map((item) => {
          const active = item.value === optimisticSelection;
          const disabled = counts[item.value] === 0;
          return (
            <button
              type="button"
              className={active ? "active" : ""}
              aria-label={`${item.label}，${counts[item.value]}个合约记录`}
              aria-pressed={active}
              title={`${counts[item.value]}个合约记录`}
              disabled={disabled || isPending}
              onPointerEnter={() => prefetchWindow(item.value)}
              onFocus={() => prefetchWindow(item.value)}
              onClick={() => selectWindow(item.value)}
              key={item.value}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
      <span className="expiration-status" aria-live="polite">{isPending ? "正在更新…" : ""}</span>
    </div>
  );
}
