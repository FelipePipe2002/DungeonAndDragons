import { useEffect, useState } from "react"

import { Card } from "@/components/ui/card"
import { MentionField } from "@/components/mentionField/MentionField"
import { Separator } from "@/components/ui/separator"
import { fetchEstadoById } from "@/lib/services/estado-api.service"
import type { Estado } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Crown } from "lucide-react"

export function EstadoResumeDialog({
  estadoId,
  className,
  onClick,
}: {
  estadoId: number
  className?: string
  onClick?: () => void
}) {
  const [estado, setEstado] = useState<Estado | null>(null)

  useEffect(() => {
    let isActive = true
    void fetchEstadoById(estadoId)
      .then((next) => {
        if (!isActive) return
        setEstado(next)
      })
      .catch(() => {
        if (!isActive) return
        setEstado(null)
      })

    return () => {
      isActive = false
    }
  }, [estadoId])

  if (!estado) return null

  const interactive = typeof onClick === "function"
  const previewText = estado.descripcion || estado.historia

  return (
    <Card
      className={cn(
        "w-80 border-primary/20 bg-background p-4 shadow-lg",
        interactive && "cursor-pointer transition-colors hover:bg-secondary/40",
        className,
      )}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
    >
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-sm border-2 border-primary/30 bg-primary/10">
          {estado.imagen ? <img src={estado.imagen} alt={estado.nombre} className="size-full object-cover" /> : <Crown className="size-6 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-lg font-bold text-primary leading-tight truncate">{estado.nombre}</h3>
          <p className="text-xs text-muted-foreground">{estado.tipo}</p>
          {estado.gobiernoTipo ? <p className="text-[11px] text-muted-foreground">Gobierno: {estado.gobiernoTipo}</p> : null}
        </div>
      </div>

      <Separator className="my-3" />

      <div className="space-y-2">
        {previewText ? (
          <MentionField
            source="auto"
            value={previewText}
            editable={false}
            className="block text-xs leading-relaxed text-foreground/80 line-clamp-3"
          />
        ) : null}

      </div>
    </Card>
  )
}
