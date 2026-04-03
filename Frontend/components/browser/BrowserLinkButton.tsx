import Link from "next/link"
import type { ComponentType } from "react"

type BrowserLinkButtonProps = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  active?: boolean
}

export function BrowserLinkButton({ href, label, icon: Icon, active = false }: BrowserLinkButtonProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-xs font-medium transition-all ${
        active
          ? "border-[#8a4a24] bg-[linear-gradient(135deg,#8f4c26,#703619)] text-[#fff8ef] shadow-[0_6px_14px_rgba(75,41,19,0.24)]"
          : "border-[#d8c7ac] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,238,223,0.9))] text-[#6d5640] hover:border-[#a97647] hover:text-[#3f2b1d]"
      }`}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  )
}
