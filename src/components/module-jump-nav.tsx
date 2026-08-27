"use client";

import { useEffect, useState } from "react";

const modules = [
  { id: "module-price", index: "01", label: "趋势与关键位" },
  { id: "module-momentum", index: "02", label: "动量与波动" },
  { id: "module-options", index: "03", label: "期权结构" },
] as const;

type ModuleId = (typeof modules)[number]["id"];

export function ModuleJumpNav() {
  const [activeId, setActiveId] = useState<ModuleId>(modules[0].id);

  useEffect(() => {
    const elements = modules.map((item) => document.getElementById(item.id)).filter((item): item is HTMLElement => Boolean(item));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveId(visible.target.id as ModuleId);
    }, { rootMargin: "-18% 0px -64%", threshold: [0, 0.1, 0.4] });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const jump = (id: string) => {
    setActiveId(id as ModuleId);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav className="module-jump-nav" aria-label="研究模块快速导航">
      {modules.map((item) => <button type="button" className={activeId === item.id ? "active" : ""} aria-current={activeId === item.id ? "location" : undefined} onClick={() => jump(item.id)} key={item.id}><b>{item.index}</b><span>{item.label}</span></button>)}
    </nav>
  );
}
