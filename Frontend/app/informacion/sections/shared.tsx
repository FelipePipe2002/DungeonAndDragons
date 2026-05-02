import type React from "react"

import { BrowserListPanel } from "@/components/browser/BrowserListPanel"
import { BrowserSearch } from "@/components/browser/BrowserSearch"

export const BOOK_FILE_ACCEPT =
  ".pdf,.epub,.txt,.md,application/pdf,application/epub+zip,text/plain,text/markdown"

export function formatByteSize(byteSize: number) {
  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    return "0 B"
  }

  if (byteSize < 1024) {
    return `${byteSize} B`
  }

  const units = ["KB", "MB", "GB"]
  let value = byteSize / 1024
  let index = 0

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`
}

export function getListItemClassName(isActive: boolean) {
  return `w-full rounded-sm border p-3 text-left transition-colors ${
    isActive
      ? "border-[#a77243] bg-[linear-gradient(135deg,rgba(247,235,213,0.95),rgba(238,219,187,0.9))] shadow-[inset_0_0_0_1px_rgba(167,114,67,0.26)]"
      : "border-[#d6c2a5] bg-white/72 hover:border-[#a77243] hover:bg-[linear-gradient(135deg,rgba(250,240,222,0.9),rgba(244,228,200,0.86))]"
  }`
}

type InformationSidebarProps = {
  query: string
  onQueryChange: (value: string) => void
  placeholder: string
  children: React.ReactNode
  actions?: React.ReactNode
  controls?: React.ReactNode
}

export function InformationSidebar({
  query,
  onQueryChange,
  placeholder,
  children,
  actions,
  controls,
}: InformationSidebarProps) {
  return (
    <BrowserListPanel>
      {actions ? <div className="mb-3 flex justify-end">{actions}</div> : null}
      <BrowserSearch value={query} onChange={onQueryChange} placeholder={placeholder} controls={controls} />
      {children}
    </BrowserListPanel>
  )
}
