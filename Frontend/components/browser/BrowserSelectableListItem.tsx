import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react"

type BrowserSelectableListItemProps = {
  isActive: boolean
  accentColor?: string
  children: ReactNode
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">

export function BrowserSelectableListItem({ isActive, accentColor, className, style, children, type = "button", ...props }: BrowserSelectableListItemProps) {
  const accentStyle = accentColor ? { borderLeftWidth: 4, borderLeftColor: accentColor } : undefined

  return (
    <button
      type={type}
      className={`w-full rounded-sm border p-3 text-left transition-colors ${
        isActive
          ? "border-[#a77243] bg-[linear-gradient(135deg,rgba(247,235,213,0.95),rgba(238,219,187,0.9))] shadow-[inset_0_0_0_1px_rgba(167,114,67,0.26)]"
          : "border-[#d6c2a5] bg-white/72 hover:border-[#a77243] hover:bg-[linear-gradient(135deg,rgba(250,240,222,0.9),rgba(244,228,200,0.86))]"
      }${className ? ` ${className}` : ""}`}
      style={{ ...accentStyle, ...style } as CSSProperties}
      {...props}
    >
      {children}
    </button>
  )
}
