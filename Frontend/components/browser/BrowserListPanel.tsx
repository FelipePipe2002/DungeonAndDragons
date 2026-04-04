import type { ReactNode } from "react"

type BrowserListPanelProps = {
  children: ReactNode
}

export function BrowserListPanel({ children }: BrowserListPanelProps) {
  return (
    <aside
      className="flex min-h-0 h-[calc(100dvh-var(--browser-content-offset,15rem))] flex-col overflow-hidden rounded-sm border border-[#d8c7ab] bg-[linear-gradient(180deg,rgba(255,252,246,0.98),rgba(245,236,222,0.96))] p-4 shadow-[0_12px_26px_rgba(48,33,18,0.12)]"
      style={{ scrollbarGutter: "stable" }}
    >
      {children}
    </aside>
  )
}
