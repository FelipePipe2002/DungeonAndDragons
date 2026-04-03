"use client"

import { useEffect, useMemo, useState } from "react"

import { CreateLandmarkEventDialog } from "@/components/dialog/detailed/CreateLandmarkEventDialog"
import { MentionField } from "@/components/mentionField/MentionField"
import { SearchInput } from "@/components/search/SearchInput"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import { deleteLandmark, fetchLandmarkById, updateLandmark } from "@/lib/services/landmark-api.service"
import { parseTagList } from "@/lib/tags"
import type { Landmark, LandmarkEvent } from "@/lib/types"
import {
  BookOpenText,
  Building2,
  CalendarDays,
  MapPin,
  Pencil,
  Plus,
  Save,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react"

interface LandmarkDetailDialogProps {
  landmarkId?: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onLandmarkUpdated?: (landmark: Landmark) => void
  onLandmarkDeleted?: (landmarkId: number) => void
}

type LandmarkFormState = {
  nombre: string
  icono: string
  poblacion: string
  descripcionCorta: string
  historia: string
  tags: string
}

const EVENTS_PER_PAGE = 5

const EMPTY_LANDMARK_FORM_STATE: LandmarkFormState = {
  nombre: "",
  icono: "",
  poblacion: "",
  descripcionCorta: "",
  historia: "",
  tags: "",
}

const tipoLabels: Record<string, string> = {
  ciudad: "Ciudad",
  pueblo: "Pueblo",
  aldea: "Aldea",
  fuerte: "Fuerte",
  puente: "Puente",
  bandera: "Bandera",
  campamento: "Campamento",
  mazmorra: "Mazmorra",
}

function isImageIcon(icono: string) {
  return (
    icono.startsWith("http://") ||
    icono.startsWith("https://") ||
    icono.startsWith("data:") ||
    icono.startsWith("/")
  )
}

function LandmarkIcon({ landmark, className }: { landmark: Landmark; className: string }) {
  if (isImageIcon(landmark.icono)) {
    return <img src={landmark.icono} alt={landmark.nombre} className={`${className} object-contain`} />
  }

  return <MapPin className={className} />
}

function toLandmarkFormState(landmark: Landmark): LandmarkFormState {
  return {
    nombre: landmark.nombre,
    icono: landmark.icono,
    poblacion: landmark.poblacion !== undefined ? String(landmark.poblacion) : "",
    descripcionCorta: landmark.descripcionCorta ?? "",
    historia: landmark.historia ?? "",
    tags: landmark.tags.join(", "),
  }
}

function toOptionalText(value: string): string | undefined {
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

export function LandmarkDetailDialog({
  landmarkId,
  open,
  onOpenChange,
  onLandmarkUpdated,
  onLandmarkDeleted,
}: LandmarkDetailDialogProps) {
  const [currentLandmark, setCurrentLandmark] = useState<Landmark | null>(null)
  const [eventSearch, setEventSearch] = useState("")
  const [eventsPage, setEventsPage] = useState(1)
  const [isCreateEventDialogOpen, setIsCreateEventDialogOpen] = useState(false)
  const [editingEventIndex, setEditingEventIndex] = useState<number | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [eventSaveError, setEventSaveError] = useState<string | null>(null)
  const [formState, setFormState] = useState<LandmarkFormState>(EMPTY_LANDMARK_FORM_STATE)

  useEffect(() => {
    if (!open) {
      setCurrentLandmark(null)
      setFormState(EMPTY_LANDMARK_FORM_STATE)
      return
    }

    setEventSearch("")
    setEventsPage(1)
    setIsCreateEventDialogOpen(false)
    setEditingEventIndex(null)
    setIsEditing(false)
    setSaveError(null)
    setEventSaveError(null)

    if (typeof landmarkId !== "number") {
      setCurrentLandmark(null)
      setFormState(EMPTY_LANDMARK_FORM_STATE)
      return
    }

    let isActive = true

    void fetchLandmarkById(landmarkId)
      .then((nextLandmark) => {
        if (!isActive) return
        setCurrentLandmark(nextLandmark)
        setFormState(toLandmarkFormState(nextLandmark))
      })
      .catch(() => {
        if (!isActive) return
        setCurrentLandmark(null)
        setFormState(EMPTY_LANDMARK_FORM_STATE)
      })

    return () => {
      isActive = false
    }
  }, [landmarkId, open])

  const filteredEvents = useMemo(() => {
    if (!currentLandmark) return []
    const query = eventSearch.toLowerCase()
    return currentLandmark.eventos.reduce<Array<{ event: LandmarkEvent; index: number }>>((acc, event, index) => {
      if (
        !eventSearch.trim() ||
        event.nombre.toLowerCase().includes(query) ||
        event.descripcion.toLowerCase().includes(query) ||
        (event.fecha && event.fecha.toLowerCase().includes(query))
      ) {
        acc.push({ event, index })
      }
      return acc
    }, [])
  }, [currentLandmark, eventSearch])

  const totalEventPages = Math.max(1, Math.ceil(filteredEvents.length / EVENTS_PER_PAGE))

  useEffect(() => {
    setEventsPage((current) => Math.min(current, totalEventPages))
  }, [totalEventPages])

  const paginatedEvents = useMemo(() => {
    const startIndex = (eventsPage - 1) * EVENTS_PER_PAGE
    return filteredEvents.slice(startIndex, startIndex + EVENTS_PER_PAGE)
  }, [eventsPage, filteredEvents])

  const editingEvent = useMemo(() => {
    if (!currentLandmark) return null
    if (editingEventIndex === null) return null
    return currentLandmark.eventos[editingEventIndex] ?? null
  }, [currentLandmark, editingEventIndex])

  if (!currentLandmark) return null

  const previewTags = isEditing ? parseTagList(formState.tags) : currentLandmark.tags
  const previewName = isEditing ? formState.nombre.trim() || currentLandmark.nombre : currentLandmark.nombre
  const previewPopulation =
    isEditing && formState.poblacion.trim().length > 0
      ? Number(formState.poblacion)
      : currentLandmark.poblacion

  const previewLandmark: Landmark = isEditing
    ? {
        ...currentLandmark,
        nombre: previewName,
        icono: formState.icono.trim(),
      }
    : currentLandmark

  const handleStartEdit = () => {
    setFormState(toLandmarkFormState(currentLandmark))
    setIsEditing(true)
    setSaveError(null)
  }

  const handleCancelEdit = () => {
    setFormState(toLandmarkFormState(currentLandmark))
    setIsEditing(false)
    setSaveError(null)
  }

  const handleSaveEdit = async () => {
    const normalizedName = formState.nombre.trim()
    if (!normalizedName) {
      setSaveError("El nombre del landmark es obligatorio.")
      return
    }

    let parsedPopulation: number | undefined
    if (formState.poblacion.trim().length > 0) {
      const parsedValue = Number(formState.poblacion)
      if (!Number.isFinite(parsedValue) || parsedValue < 0) {
        setSaveError("La poblacion debe ser un numero valido.")
        return
      }

      parsedPopulation = Math.round(parsedValue)
    }

    const nextLandmark: Landmark = {
      ...currentLandmark,
      nombre: normalizedName,
      icono: formState.icono.trim(),
      poblacion: parsedPopulation,
      descripcionCorta: toOptionalText(formState.descripcionCorta),
      historia: toOptionalText(formState.historia),
      tags: parseTagList(formState.tags),
    }

    try {
      const { id: _ignoredLandmarkId, ...payload } = nextLandmark
      const savedLandmark = await updateLandmark(nextLandmark.id, payload)
      setCurrentLandmark(savedLandmark)
      setFormState(toLandmarkFormState(savedLandmark))
      setIsEditing(false)
      setSaveError(null)
      onLandmarkUpdated?.(savedLandmark)
    } catch (error) {
      setSaveError(getBackendErrorMessage(error, "No se pudo guardar el landmark."))
    }
  }

  const handleSaveEvent = async (event: LandmarkEvent) => {
    const nextEvents =
      editingEventIndex === null
        ? [event, ...currentLandmark.eventos]
        : currentLandmark.eventos.map((currentEvent, index) =>
            index === editingEventIndex ? event : currentEvent,
          )

    const nextLandmark: Landmark = {
      ...currentLandmark,
      eventos: nextEvents,
    }

    try {
      const { id: _ignoredLandmarkId, ...payload } = nextLandmark
      const savedLandmark = await updateLandmark(nextLandmark.id, payload)
      setCurrentLandmark(savedLandmark)
      if (editingEventIndex === null) {
        setEventSearch("")
        setEventsPage(1)
      }
      setEditingEventIndex(null)
      setEventSaveError(null)
      onLandmarkUpdated?.(savedLandmark)
      return true
    } catch (error) {
      setEventSaveError(getBackendErrorMessage(error, "No se pudo guardar el evento."))
      return false
    }
  }

  const handleDeleteRequest = () => {
    if (!currentLandmark) return
    setIsDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!currentLandmark) return

    try {
      await deleteLandmark(currentLandmark.id)
      setCurrentLandmark(null)
      setEventSearch("")
      setEventsPage(1)
      setIsCreateEventDialogOpen(false)
      setEditingEventIndex(null)
      setIsEditing(false)
      setSaveError(null)
      setEventSaveError(null)
      setFormState(EMPTY_LANDMARK_FORM_STATE)
      onLandmarkDeleted?.(currentLandmark.id)
      onOpenChange(false)
    } catch (error) {
      setSaveError(getBackendErrorMessage(error, "No se pudo eliminar el landmark."))
    }
  }

  const handleDialogOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setEventSearch("")
      setEventsPage(1)
      setIsCreateEventDialogOpen(false)
      setEditingEventIndex(null)
      setIsEditing(false)
      setSaveError(null)
      setEventSaveError(null)
      setFormState(toLandmarkFormState(currentLandmark))
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="parchment max-h-[90vh] max-w-6xl overflow-hidden p-0">
          <div className="absolute right-12 top-3.5 z-20 flex items-center gap-1.5">
            {!isEditing && currentLandmark ? (
              <>
                <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={handleDeleteRequest}>
                  <Trash2 className="mr-1 size-3" />
                  Eliminar
                </Button>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleStartEdit}>
                  <Pencil className="mr-1 size-3" />
                  Editar
                </Button>
              </>
            ) : isEditing ? (
              <>
                <Button size="sm" className="h-7 px-2 text-xs" onClick={handleSaveEdit}>
                  <Save className="mr-1 size-3" />
                  Guardar
                </Button>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleCancelEdit}>
                  <X className="mr-1 size-3" />
                  Cancelar
                </Button>
              </>
            ) : null}
          </div>

          <div className="flex h-[85vh] flex-col">
            <div className="scroll-banner shrink-0">
              <DialogHeader>
                <div className="flex items-center gap-4">
                  <div className="flex size-14 items-center justify-center rounded-sm border-2 border-primary/30 bg-primary/10">
                    <LandmarkIcon landmark={previewLandmark} className="size-7 text-primary" />
                  </div>
                  <div>
                    {isEditing ? (
                      <>
                        <DialogTitle className="sr-only">{previewName}</DialogTitle>
                        <Input
                          value={formState.nombre}
                          onChange={(event) => setFormState((prev) => ({ ...prev, nombre: event.target.value }))}
                          className="h-9 border-primary/30 bg-card/80 font-serif text-lg"
                        />
                      </>
                    ) : (
                      <DialogTitle className="text-2xl font-serif text-primary">{currentLandmark.nombre}</DialogTitle>
                    )}

                    <div className="mt-1 flex items-center gap-3 text-sm">
                      <Badge variant="outline" className="border-primary/30 text-[10px] text-primary">
                        {tipoLabels[currentLandmark.tipo] ?? currentLandmark.tipo}
                      </Badge>
                      {previewPopulation !== undefined && Number.isFinite(previewPopulation) && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="size-3" />
                          {Math.round(previewPopulation).toLocaleString()} habitantes
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </DialogHeader>
            </div>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <ScrollArea className="min-h-0 border-t border-border lg:border-r">
                <div className="flex flex-col gap-5 p-6">
                  {saveError && <p className="text-xs text-destructive">{saveError}</p>}

                  {isEditing && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Icono (emoji o URL)
                        </div>
                        <Input
                          value={formState.icono}
                          onChange={(event) => setFormState((prev) => ({ ...prev, icono: event.target.value }))}
                          className="h-8 text-sm"
                          placeholder="🏰 o https://..."
                        />
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Poblacion
                        </div>
                        <Input
                          value={formState.poblacion}
                          onChange={(event) => setFormState((prev) => ({ ...prev, poblacion: event.target.value }))}
                          className="h-8 text-sm"
                          placeholder="15000"
                          inputMode="numeric"
                        />
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Etiquetas
                        </div>
                        <Input
                          value={formState.tags}
                          onChange={(event) => setFormState((prev) => ({ ...prev, tags: event.target.value }))}
                          className="h-8 text-sm"
                          placeholder="tag1, tag2..."
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="ornament-divider mb-3 text-xs font-serif">Resumen</div>
                    {isEditing ? (
                      <MentionField
                        source="auto"
                        value={formState.descripcionCorta}
                        onChange={(value) => setFormState((prev) => ({ ...prev, descripcionCorta: value }))}
                        rows={3}
                        className="text-sm"
                        placeholder="Descripcion corta del landmark..."
                      />
                    ) : (
                      <MentionField
                        source="auto"
                        value={currentLandmark.descripcionCorta ?? ""}
                        editable={false}
                        className="text-sm leading-relaxed text-foreground/85"
                        emptyText="Sin resumen"
                      />
                    )}
                  </div>

                  <div>
                    <div className="ornament-divider mb-3 text-xs font-serif">
                      <BookOpenText className="size-3" />
                    </div>
                    {isEditing ? (
                      <MentionField
                        source="auto"
                        value={formState.historia}
                        onChange={(value) => setFormState((prev) => ({ ...prev, historia: value }))}
                        rows={5}
                        className="text-sm"
                        placeholder="Historia del landmark..."
                      />
                    ) : (
                      <MentionField
                        source="auto"
                        value={currentLandmark.historia ?? ""}
                        editable={false}
                        className="text-sm italic leading-relaxed text-foreground/80"
                        emptyText="Sin historia"
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col items-center rounded-sm border border-border bg-secondary/50 p-3">
                      <Building2 className="mb-1 size-4 text-primary/60" />
                      <span className="text-xl font-serif font-bold text-foreground">{currentLandmark.edificios.length}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Edificios</span>
                    </div>
                    <div className="flex flex-col items-center rounded-sm border border-border bg-secondary/50 p-3">
                      <Users className="mb-1 size-4 text-primary/60" />
                      <span className="text-xl font-serif font-bold text-foreground">{currentLandmark.personajes.length}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Personajes</span>
                    </div>
                    <div className="flex flex-col items-center rounded-sm border border-border bg-secondary/50 p-3">
                      <Shield className="mb-1 size-4 text-primary/60" />
                      <span className="text-xl font-serif font-bold text-foreground">
                        {currentLandmark.organizaciones.length}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Organizaciones</span>
                    </div>
                  </div>

                  <div>
                    <div className="ornament-divider mb-3 text-xs font-serif">Etiquetas</div>
                    {previewTags.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sin etiquetas</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {previewTags.map((tag) => (
                          <Badge key={tag} variant="outline" className="border-primary/30 text-[10px] text-primary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>

              <aside className="flex min-h-0 flex-col border-t border-border bg-secondary/20">
                <div className="space-y-3 border-b border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="size-4 text-primary" />
                      <h3 className="font-serif text-sm font-semibold text-primary">Eventos</h3>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {filteredEvents.length} de {currentLandmark.eventos.length}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => {
                      setEditingEventIndex(null)
                      setEventSaveError(null)
                      setIsCreateEventDialogOpen(true)
                    }}
                  >
                    <Plus className="mr-1.5 size-3" />
                    Agregar evento
                  </Button>

                  {currentLandmark.eventos.length > 3 && (
                    <SearchInput
                      placeholder="Buscar eventos..."
                      value={eventSearch}
                      onChange={(value) => {
                        setEventSearch(value)
                        setEventsPage(1)
                      }}
                    />
                  )}

                  {eventSaveError && <p className="text-xs text-destructive">{eventSaveError}</p>}
                </div>

                <ScrollArea className="min-h-0 flex-1">
                  <div className="space-y-2 p-4">
                    {currentLandmark.eventos.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">Sin eventos registrados</div>
                    ) : filteredEvents.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">Sin resultados</div>
                    ) : (
                      paginatedEvents.map(({ event, index }) => {
                        const itemKey = `${event.nombre}-${event.fecha ?? "sin-fecha"}-${index}`
                        return (
                          <div key={itemKey} className="relative rounded-sm border border-border bg-secondary/30 p-3 pl-4 pr-8">
                            <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-primary/50" />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="absolute right-1.5 top-1.5 size-6 text-muted-foreground hover:text-primary"
                              onClick={() => {
                                setEditingEventIndex(index)
                                setEventSaveError(null)
                                setIsCreateEventDialogOpen(true)
                              }}
                            >
                              <Pencil className="size-3.5" />
                              <span className="sr-only">Editar evento</span>
                            </Button>
                            <div className="mb-1 flex items-center gap-2">
                              <CalendarDays className="size-3 text-primary/70" />
                              <span className="font-serif text-xs font-semibold text-primary">{event.nombre}</span>
                            </div>
                            {event.fecha && <div className="mb-1 text-[10px] text-muted-foreground">{event.fecha}</div>}
                            <p className="text-xs leading-relaxed text-foreground/80">{event.descripcion}</p>
                          </div>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>

                {filteredEvents.length > 0 && (
                  <div className="flex items-center justify-between border-t border-border px-4 py-3">
                    <span className="text-[10px] text-muted-foreground">
                      Pagina {eventsPage} de {totalEventPages}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[10px]"
                        disabled={eventsPage <= 1}
                        onClick={() => setEventsPage((current) => Math.max(1, current - 1))}
                      >
                        Anterior
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[10px]"
                        disabled={eventsPage >= totalEventPages}
                        onClick={() => setEventsPage((current) => Math.min(totalEventPages, current + 1))}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Eliminar landmark"
        description={
          currentLandmark
            ? `¿Eliminar ${currentLandmark.nombre}? Esta accion no se puede deshacer.`
            : "Esta accion no se puede deshacer."
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        confirmVariant="destructive"
        onConfirm={handleConfirmDelete}
      />

      <CreateLandmarkEventDialog
        open={isCreateEventDialogOpen}
        initialEvent={editingEvent}
        onOpenChange={(nextOpen) => {
          setIsCreateEventDialogOpen(nextOpen)
          if (!nextOpen) {
            setEditingEventIndex(null)
          }
        }}
        onSaveEvent={handleSaveEvent}
      />
    </>
  )
}
