"use client"

import { useCallback, useEffect, useState } from "react"
import { Trash2 } from "lucide-react"

import { DmSectionMessage } from "@/components/dm/DmSectionMessage"
import { formatDmTimestamp } from "@/lib/dm/formatTimestamp"
import { MentionField, type MentionRef } from "@/components/mentionField/MentionField"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import { deleteDmEvent, fetchDmEvents } from "@/lib/services/dm"
import { DM_EVENTS_CHANGED_EVENT, openCreateDmEventDialog } from "@/lib/navigation/events"
import type { DmEvent } from "@/lib/types"

type DmEventsSectionProps = {
  onOpenMention: (mention: MentionRef) => void | Promise<void>
}

function sortDmEvents(events: DmEvent[]) {
  return [...events].sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0
    if (aTime !== bTime) {
      return bTime - aTime
    }
    return b.id - a.id
  })
}

export default function DmEventsSection({ onOpenMention }: DmEventsSectionProps) {
  const [events, setEvents] = useState<DmEvent[]>([])
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [isEventsLoading, setIsEventsLoading] = useState(true)
  const [deleteTargetEvent, setDeleteTargetEvent] = useState<DmEvent | null>(null)
  const [isDeletingEvent, setIsDeletingEvent] = useState(false)

  const loadEvents = useCallback(async () => {
    setIsEventsLoading(true)
    setEventsError(null)

    try {
      const storedEvents = await fetchDmEvents()
      setEvents(sortDmEvents(storedEvents))
    } catch (error) {
      setEvents([])
      setEventsError(getBackendErrorMessage(error, "No se pudieron cargar los eventos del DM."))
    } finally {
      setIsEventsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  useEffect(() => {
    const handleEventsChanged = () => {
      void loadEvents()
    }

    window.addEventListener(DM_EVENTS_CHANGED_EVENT, handleEventsChanged)
    return () => {
      window.removeEventListener(DM_EVENTS_CHANGED_EVENT, handleEventsChanged)
    }
  }, [loadEvents])

  const handleConfirmDeleteEvent = useCallback(async () => {
    if (!deleteTargetEvent || isDeletingEvent) return

    setIsDeletingEvent(true)
    setEventsError(null)
    try {
      await deleteDmEvent(deleteTargetEvent.id)
      setEvents((current) => current.filter((event) => event.id !== deleteTargetEvent.id))
      setDeleteTargetEvent(null)
    } catch (error) {
      setEventsError(getBackendErrorMessage(error, "No se pudo eliminar el evento del DM."))
    } finally {
      setIsDeletingEvent(false)
    }
  }, [deleteTargetEvent, isDeletingEvent])

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-primary">DM</h1>
          <p className="mt-1 text-sm text-muted-foreground">Eventos DM</p>
        </div>

        <Button type="button" onClick={openCreateDmEventDialog}>
          Agregar Evento
        </Button>
      </div>

      <div className="space-y-4">
        {eventsError ? <p className="text-sm text-destructive">{eventsError}</p> : null}

        {isEventsLoading ? (
          <DmSectionMessage>Cargando eventos...</DmSectionMessage>
        ) : events.length === 0 ? (
          <DmSectionMessage variant="empty">
            No hay eventos todavia. Usa <span className="font-semibold">Alt+E</span> para agregar uno.
          </DmSectionMessage>
        ) : (
          events.map((eventItem) => {
            const timestamp = formatDmTimestamp(eventItem.createdAt)

            return (
              <article key={eventItem.id} className="rounded-md border border-border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    {eventItem.titulo ? <h2 className="font-serif text-xl text-primary">{eventItem.titulo}</h2> : null}
                    {timestamp ? <p className="mt-1 text-xs text-muted-foreground">{timestamp}</p> : null}
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="h-8 px-2"
                    onClick={() => setDeleteTargetEvent(eventItem)}
                    disabled={isDeletingEvent}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                <MentionField
                  source="auto"
                  value={eventItem.descripcion}
                  editable={false}
                  emptyText=""
                  onOpenMention={onOpenMention}
                  className="text-sm leading-relaxed"
                />
              </article>
            )
          })
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTargetEvent)}
        onOpenChange={(open) => {
          if (!open && !isDeletingEvent) {
            setDeleteTargetEvent(null)
          }
        }}
        title="Eliminar evento"
        description={
          deleteTargetEvent?.titulo
            ? `Eliminar "${deleteTargetEvent.titulo}"? Esta accion no se puede deshacer.`
            : "Eliminar este evento? Esta accion no se puede deshacer."
        }
        confirmLabel={isDeletingEvent ? "Eliminando..." : "Eliminar"}
        confirmVariant="destructive"
        onConfirm={handleConfirmDeleteEvent}
      />
    </>
  )
}
