"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type TouchEvent } from "react";

type PagerTab = { id: string; label: string; content: ReactNode };

export function SectionPager({ label, tabs, accent }: { label: string; tabs: PagerTab[]; accent?: string }) {
  const [active, setActive] = useState(0);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleNavigation = (event: Event) => {
      const tabId = (event as CustomEvent<{ tabId?: string }>).detail?.tabId;
      const index = tabs.findIndex((tab) => tab.id === tabId);
      if (index < 0) return;
      setActive(index);
      window.requestAnimationFrame(() => root.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };
    window.addEventListener("dashboard:navigate", handleNavigation);
    return () => window.removeEventListener("dashboard:navigate", handleNavigation);
  }, [tabs]);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    if (target.closest(".price-chart, .level-map-scroll")) {
      gesture.current = null;
      return;
    }
    const touch = event.touches[0];
    gesture.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (!gesture.current) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - gesture.current.x;
    const dy = touch.clientY - gesture.current.y;
    gesture.current = null;
    if (Math.abs(dx) < 45 || Math.abs(dx) <= Math.abs(dy) * 1.15) return;
    setActive((current) => dx < 0 ? Math.min(current + 1, tabs.length - 1) : Math.max(current - 1, 0));
  };

  return (
    <div ref={root} className="section-pager" style={accent ? { "--module-accent": accent } as CSSProperties : undefined}>
      <div className="section-tabs" role="tablist" aria-label={label}>
        {tabs.map((tab, index) => (
          <button type="button" role="tab" aria-selected={active === index} aria-controls={`${tab.id}-panel`} id={`${tab.id}-tab`} className={active === index ? "active" : ""} onClick={() => setActive(index)} key={tab.id}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="section-pager-body" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="section-tab-pane active" role="tabpanel" id={`${tabs[active].id}-panel`} aria-labelledby={`${tabs[active].id}-tab`} key={tabs[active].id}>
          {tabs[active].content}
        </div>
      </div>
      <div className="section-pager-foot"><span>点上方标签，或左右滑动切换</span><b>{active + 1} / {tabs.length}</b></div>
    </div>
  );
}
