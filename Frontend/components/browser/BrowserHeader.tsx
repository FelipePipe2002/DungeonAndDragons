import type { ComponentType, ReactNode } from "react"

type BrowserHeaderProps = {
  title: string
  subtitle: string
  icon: ComponentType<{ className?: string }>
  tabs?: ReactNode
  actions?: ReactNode
}

export function BrowserHeader({ title, subtitle, icon: Icon, tabs, actions }: BrowserHeaderProps) {
  return (
    <section className="rounded-sm border border-[#d8c7ab] bg-[linear-gradient(135deg,rgba(255,252,246,0.98),rgba(244,234,217,0.95))] px-4 py-3 shadow-[0_10px_26px_rgba(48,33,18,0.12)] md:px-5 md:py-3.5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-sm border border-[#cda979] bg-[linear-gradient(180deg,rgba(157,106,57,0.12),rgba(123,79,44,0.08))]">
              <Icon className="size-4 text-[#7d3e1d]" />
            </div>
            <div>
              <h1 className="text-2xl font-serif text-[#6f3116]">{title}</h1>
              <p className="text-xs text-[#6a5642]">{subtitle}</p>
            </div>
          </div>
          {tabs ? <div className="flex flex-wrap gap-2">{tabs}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  )
}
