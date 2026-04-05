"use client"

import { useEffect, useState, type FormEvent } from "react"

import { MentionField } from "@/components/mentionField/MentionField"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { DmEvent } from "@/lib/types"

type CreateDmEventDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaveEvent: (event: Pick<DmEvent, "titulo" | "descripcion">) => boolean | void | Promise<boolean | void>
}

const EMPTY_FORM = {
  titulo: "",
  descripcion: "",
}

export function CreateDmEventDialog({ open, onOpenChange, onSaveEvent }: CreateDmEventDialogProps) {
  const [titulo, setTitulo] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return

    setTitulo(EMPTY_FORM.titulo)
    setDescripcion(EMPTY_FORM.descripcion)
    setSaveError(null)
    setIsSaving(false)
  }, [open])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextDescripcion = descripcion.trim()
    if (!nextDescripcion) {
      setSaveError("El contenido del evento es obligatorio.")
      return
    }

    setIsSaving(true)
    let saved: boolean | void = undefined
    try {
      saved = await onSaveEvent({
        titulo: titulo.trim() || undefined,
        descripcion: nextDescripcion,
      })
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
          <DialogTitle className="font-serif text-xl text-primary">Agregar Evento</DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {saveError ? <p className="text-xs text-destructive">{saveError}</p> : null}

          <div className="space-y-1.5">
            <label htmlFor="dm-event-title" className="text-xs font-medium text-foreground">
              Titulo (opcional)
            </label>
            <Input
              id="dm-event-title"
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              placeholder="El regreso del dragon"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Contenido</label>
            <MentionField
              source="auto"
              value={descripcion}
              onChange={setDescripcion}
              rows={6}
              className="text-sm"
              placeholder="Escribe lo que quieras registrar del evento..."
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? "Guardando..." : "Agregar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
