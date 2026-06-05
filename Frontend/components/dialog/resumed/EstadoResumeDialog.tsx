import { useEffect, useState } from "react"

import { EstadoDetailDialog } from "@/components/dialog/detailed/EstadoDetailDialog"
import {
  ResumeDialogCard,
  ResumeDialogPreviewText,
  ResumeDialogSectionSeparator,
} from "@/components/dialog/shared/resume-card"
import { fetchEstadoById } from "@/lib/services/estado-api.service"
import type { Estado } from "@/lib/types"
import { Crown } from "lucide-react"

export function EstadoResumeDialog({
  estadoId,
  className,
  onClick,
  openOnClick = true,
}: {
  estadoId: number
  className?: string
  onClick?: () => void
  openOnClick?: boolean
}) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

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

  function handleClick() {
    onClick?.()
    if (openOnClick) {
      setIsDetailOpen(true)
    }
  }

  const previewText = estado.descripcion || estado.historia

  return (
    <>
      <ResumeDialogCard className={className} onClick={handleClick}>
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-sm border-2 border-primary/30 bg-primary/10">
            {estado.imagen ? <img src={estado.imagen} alt={estado.nombre} className="size-full object-cover" /> : <Crown className="size-6 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="truncate font-serif text-lg font-bold leading-tight text-primary">{estado.nombre}</h3>
            <p className="text-xs text-muted-foreground">{estado.tipo}</p>
            {estado.gobiernoTipo ? <p className="text-[11px] text-muted-foreground">Gobierno: {estado.gobiernoTipo}</p> : null}
          </div>
        </div>

        <ResumeDialogSectionSeparator />

        <div className="space-y-2">
          {previewText ? (
            <ResumeDialogPreviewText value={previewText} />
          ) : null}
        </div>
      </ResumeDialogCard>

      <EstadoDetailDialog
        estadoId={estado.id}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onEstadoUpdated={setEstado}
        onEstadoDeleted={() => {
          setEstado(null)
          setIsDetailOpen(false)
        }}
      />
    </>
  )
}
