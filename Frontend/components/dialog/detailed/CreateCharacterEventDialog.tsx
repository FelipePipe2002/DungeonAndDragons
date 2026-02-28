"use client"

import { useEffect, useState, type FormEvent } from "react"

import { MentionField } from "@/components/mentionField/MentionField"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { CharacterEvent } from "@/lib/types"

type CreateCharacterEventDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaveEvent: (event: CharacterEvent) => boolean | void | Promise<boolean | void>
  initialEvent?: CharacterEvent | null
  mode?: "create" | "edit"
}

type CharacterEventFormState = {
  sesion: string
  orden: string
  descripcion: string
}

const EMPTY_FORM: CharacterEventFormState = {
  sesion: "",
  orden: "",
  descripcion: "",
}

function toSessionDigits(value: string) {
  return value.replace(/\D+/g, "")
}

function parsePositiveSessionNumber(value: string) {
  if (!/^\d+$/.test(value)) return null
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

function extractSessionDigits(value: string) {
  const matched = value.match(/\d+/)
  return matched ? matched[0] : ""
}

export function CreateCharacterEventDialog({
  open,
  onOpenChange,
  onSaveEvent,
  initialEvent,
  mode = "create",
}: CreateCharacterEventDialogProps) {
  const [formState, setFormState] = useState<CharacterEventFormState>(EMPTY_FORM)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    setFormState(
      initialEvent
        ? {
            sesion: extractSessionDigits(initialEvent.sesion),
            orden: extractSessionDigits(initialEvent.fecha ?? ""),
            descripcion: initialEvent.descripcion,
          }
        : EMPTY_FORM,
    )
    setSaveError(null)
  }, [initialEvent, open])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const sesion = toSessionDigits(formState.sesion)
    const sessionNumber = parsePositiveSessionNumber(sesion)
    if (sessionNumber === null) {
      setSaveError("La sesion debe ser un numero mayor a 0.")
      return
    }

    const orderNumber = parsePositiveSessionNumber(toSessionDigits(formState.orden))
    if (orderNumber === null) {
      setSaveError("El orden debe ser un numero mayor a 0.")
      return
    }

    const nextEvent: CharacterEvent = {
      sesion: String(sessionNumber),
      descripcion: formState.descripcion.trim(),
      fecha: String(orderNumber),
    }

    const saved = await onSaveEvent(nextEvent)
    if (saved === false) return

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="parchment max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-primary">
            {mode === "edit" ? "Editar nota de sesion" : "Nueva nota de sesion"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {mode === "edit"
              ? "Actualiza la nota seleccionada."
              : "Agrega un registro de lo ocurrido con este personaje. El orden mayor aparece arriba."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {saveError && <p className="text-xs text-destructive">{saveError}</p>}

          <div className="space-y-1.5">
            <label htmlFor="character-event-session" className="text-xs font-medium text-foreground">
              Sesion
            </label>
            <Input
              id="character-event-session"
              value={formState.sesion}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  sesion: toSessionDigits(event.target.value),
                }))
              }
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="4"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="character-event-order" className="text-xs font-medium text-foreground">
              Orden
            </label>
            <Input
              id="character-event-order"
              value={formState.orden}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  orden: toSessionDigits(event.target.value),
                }))
              }
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="1"
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
              placeholder="Describe lo que ocurrio en esta sesion..."
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm">
              {mode === "edit" ? "Guardar cambios" : "Agregar nota"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
