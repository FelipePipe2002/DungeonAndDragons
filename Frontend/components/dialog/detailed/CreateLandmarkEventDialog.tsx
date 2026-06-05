"use client"

import { useEffect, useState, type FormEvent } from "react"

import { MentionField } from "@/components/mentionField/MentionField"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toOptionalText } from "@/lib/normalize"
import type { LandmarkEvent } from "@/lib/types"

type CreateLandmarkEventDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaveEvent: (event: LandmarkEvent) => boolean | void | Promise<boolean | void>
  initialEvent?: LandmarkEvent | null
}

type LandmarkEventFormState = {
  nombre: string
  fecha: string
  descripcion: string
}

const EMPTY_FORM: LandmarkEventFormState = {
  nombre: "",
  fecha: "",
  descripcion: "",
}

function toFormState(event: LandmarkEvent | null | undefined): LandmarkEventFormState {
  if (!event) return EMPTY_FORM

  return {
    nombre: event.nombre,
    fecha: event.fecha ?? "",
    descripcion: event.descripcion,
  }
}

export function CreateLandmarkEventDialog({
  open,
  onOpenChange,
  onSaveEvent,
  initialEvent,
}: CreateLandmarkEventDialogProps) {
  const [formState, setFormState] = useState<LandmarkEventFormState>(EMPTY_FORM)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const isEditMode = Boolean(initialEvent)

  useEffect(() => {
    if (!open) return

    setFormState(toFormState(initialEvent))
    setSaveError(null)
    setIsSaving(false)
  }, [initialEvent, open])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nombre = formState.nombre.trim()
    if (!nombre) {
      setSaveError("El nombre del evento es obligatorio.")
      return
    }

    const nextEvent: LandmarkEvent = {
      nombre,
      descripcion: formState.descripcion.trim(),
      fecha: toOptionalText(formState.fecha),
    }

    setIsSaving(true)
    let saved: boolean | void = undefined
    try {
      saved = await onSaveEvent(nextEvent)
    } finally {
      setIsSaving(false)
    }
    if (saved === false) return

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="parchment max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-primary">
            {isEditMode ? "Editar evento" : "Crear evento"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isEditMode ? "Actualiza los datos del evento." : "Agrega un evento historico para este landmark."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {saveError && <p className="text-xs text-destructive">{saveError}</p>}

          <div className="space-y-1.5">
            <label htmlFor="landmark-event-name" className="text-xs font-medium text-foreground">
              Nombre del evento
            </label>
            <Input
              id="landmark-event-name"
              value={formState.nombre}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  nombre: event.target.value,
                }))
              }
              placeholder="Fundacion de la ciudad"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="landmark-event-date" className="text-xs font-medium text-foreground">
              Fecha (opcional)
            </label>
            <Input
              id="landmark-event-date"
              value={formState.fecha}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  fecha: event.target.value,
                }))
              }
              placeholder="1492 DR"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Descripcion</label>
            <MentionField
              source="auto"
              value={formState.descripcion}
              onChange={(value) =>
                setFormState((prev) => ({
                  ...prev,
                  descripcion: value,
                }))
              }
              rows={4}
              className="text-sm"
              placeholder="Describe que paso en este evento..."
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? "Guardando..." : isEditMode ? "Guardar cambios" : "Crear evento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
