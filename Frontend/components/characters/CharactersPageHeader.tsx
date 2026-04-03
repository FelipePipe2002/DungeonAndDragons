import type { ComponentType } from "react"

import { Button } from "@/components/ui/button"

type CharacterScope = "players" | "npcs"

const CHARACTER_SCOPE_LABELS = {
  players: "Jugadores",
  npcs: "Personajes",
} as const

type CharactersPageHeaderProps = {
  title: string
  subtitle: string
  scope: CharacterScope
  onScopeChange: (scope: CharacterScope) => void
  onCreate: () => void
  createLabel: string
  icon: ComponentType<{ className?: string }>
  createIcon?: ComponentType<{ className?: string }>
}

export function CharactersPageHeader({
  title,
  subtitle,
  scope,
  onScopeChange,
  onCreate,
  createLabel,
  icon: Icon,
  createIcon: CreateIcon,
}: CharactersPageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="mb-2 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-sm border-2 border-primary/30 bg-primary/10">
            <Icon className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-serif text-primary">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-sm border border-border bg-card p-1">
            {(Object.keys(CHARACTER_SCOPE_LABELS) as CharacterScope[]).map((scopeOption) => {
              const isActive = scope === scopeOption
              return (
                <Button
                  key={scopeOption}
                  type="button"
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => onScopeChange(scopeOption)}
                >
                  {CHARACTER_SCOPE_LABELS[scopeOption]}
                </Button>
              )
            })}
          </div>
          <Button onClick={onCreate} className="gap-2">
            {CreateIcon ? <CreateIcon className="size-4" /> : null}
            {createLabel}
          </Button>
        </div>
      </div>
      <div className="ornament-divider mt-4">~</div>
    </div>
  )
}
