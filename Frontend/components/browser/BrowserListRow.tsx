import type { ReactNode } from "react"

type BrowserListRowProps = {
  isActive: boolean
  children: ReactNode
  actions?: ReactNode
}

export function BrowserListRow({ isActive, children, actions }: BrowserListRowProps) {
  return (
    <div
      className={`flex items-center gap-2 rounded-sm border px-2 py-1.5 transition-colors ${
        isActive ? "border-primary/60 bg-primary/5" : "border-border bg-card hover:border-primary/50 hover:bg-primary/5"
      }`}
    >
      {children}
      {actions ? actions : null}
    </div>
  )
}
