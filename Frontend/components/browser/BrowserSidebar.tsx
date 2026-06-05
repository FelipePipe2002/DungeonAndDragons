import type { ReactNode } from "react"

import { BrowserListPanel } from "@/components/browser/BrowserListPanel"
import { BrowserSearch } from "@/components/browser/BrowserSearch"

type BrowserSidebarProps = {
  query: string
  onQueryChange: (value: string) => void
  placeholder: string
  children: ReactNode
  actions?: ReactNode
  controls?: ReactNode
}

export function BrowserSidebar({ query, onQueryChange, placeholder, children, actions, controls }: BrowserSidebarProps) {
  return (
    <BrowserListPanel>
      {actions ? <div className="mb-3 flex justify-end">{actions}</div> : null}
      <BrowserSearch value={query} onChange={onQueryChange} placeholder={placeholder} controls={controls} />
      {children}
    </BrowserListPanel>
  )
}
