import type { ReactNode } from "react"

type BrowserDetailPanelProps = {
  children: ReactNode
}

export function BrowserDetailPanel({ children }: BrowserDetailPanelProps) {
  return (
    <div
      className="min-w-0 min-h-0 h-[calc(100dvh-var(--browser-content-offset,16rem))] overflow-y-auto pr-1"
      style={{ scrollbarGutter: "stable" }}
    >
      {children}
    </div>
  )
}
