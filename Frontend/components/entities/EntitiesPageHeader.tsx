import type { ReactNode } from "react"

type EntitiesPageHeaderProps = {
  showHeader: boolean
  title: string
  summary?: ReactNode
  icon: ReactNode
  action?: ReactNode
}

export function EntitiesPageHeader({ showHeader, title, summary, icon, action }: EntitiesPageHeaderProps) {
  if (showHeader) {
    return (
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-sm border-2 border-primary/30 bg-primary/10">
              {icon}
            </div>
            <div>
              <h1 className="text-3xl font-serif text-primary">{title}</h1>
              {summary ? <p className="text-sm text-muted-foreground">{summary}</p> : null}
            </div>
          </div>
          {action}
        </div>
        <div className="ornament-divider mt-4">~</div>
      </div>
    )
  }

  if (!action) {
    return null
  }

  return <div className="mb-4 flex justify-end">{action}</div>
}
