"use client";

import type { ReactNode } from "react";

export function BriefLink({ targetId, className, children, hint = "查看依据 →" }: { targetId: string; className: string; children: ReactNode; hint?: string }) {
  const navigate = () => {
    window.dispatchEvent(new CustomEvent("dashboard:navigate", { detail: { tabId: targetId } }));
  };

  return <button type="button" className={className} onClick={navigate}>{children}<i>{hint}</i></button>;
}
