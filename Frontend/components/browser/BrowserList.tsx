import type { ReactNode } from "react"

type BrowserListProps = {
  children: ReactNode
}

export function BrowserList({ children }: BrowserListProps) {
  return <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">{children}</div>
}
