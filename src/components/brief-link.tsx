"use client";

import type { ReactNode } from "react";

export function BriefLink({ targetId, className, children }: { targetId: string; className: string; children: ReactNode }) {
  const navigate = () => {
    window.dispatchEvent(new CustomEvent("dashboard:navigate", { detail: { tabId: targetId } }));
  };

  return <button type="button" className={className} onClick={navigate}>{children}<i>查看依据 →</i></button>;
}
