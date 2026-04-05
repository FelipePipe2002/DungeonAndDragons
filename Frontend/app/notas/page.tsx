"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { BuildingDetailDialog } from "@/components/dialog/detailed/BuildingDetailDialog"
import { CharacterDetailDialog, type CharacterDetailData } from "@/components/dialog/detailed/CharacterDetailDialog"
import { LandmarkDetailDialog } from "@/components/dialog/detailed/LandmarkDetailDialog"
import { OrganizationDetailDialog } from "@/components/dialog/detailed/OrganizationDetailDialog"
import { MentionField, type MentionRef } from "@/components/mentionField/MentionField"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Button } from "@/components/ui/button"
import { fetchBuildings } from "@/lib/services/building-api.service"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import { fetchCharacters } from "@/lib/services/character-api.service"
import { deleteDmEvent, fetchDmEvents } from "@/lib/services/dm-events-api.service"
import { fetchDmNotes, updateDmNotes } from "@/lib/services/dm-notes-api.service"
import { fetchLandmarks } from "@/lib/services/landmark-api.service"
import { openCreateDmEventDialog, DM_EVENTS_CHANGED_EVENT } from "@/lib/navigation/global-create-events"
import { getSubnavActiveValue, getSubnavConfig } from "@/lib/navigation/subnav"
import { fetchOrganizations } from "@/lib/services/organization-api.service"
import type { Building, Character, DmEvent, Landmark, Organization } from "@/lib/types"
import { Trash2 } from "lucide-react"

const DM_NOTES_SAVE_DEBOUNCE_MS = 450

type NotesSection = "dm-notes" | "dm-events"

type ReferenceIndexes = {
  landmarksById: Map<number, Landmark>
  buildingsById: Map<number, Building>
  charactersById: Map<number, Character>
  organizationsById: Map<number, Organization>
  landmarkNameById: Map<number, string>
  buildingNameById: Map<number, string>
  organizationNameById: Map<number, string>
}

function mergeById<T extends { id: number }>(...collections: T[][]): T[] {
  const byId = new Map<number, T>()
  for (const items of collections) {
    for (const item of items) {
      byId.set(item.id, item)
    }
  }
  return Array.from(byId.values())
}

async function buildReferenceIndexes(): Promise<ReferenceIndexes> {
  const storedLandmarks = await fetchLandmarks().catch(() => [])
  const landmarks = mergeById(storedLandmarks)
  const landmarkNameById = new Map<number, string>()
  for (const landmark of landmarks) {
    landmarkNameById.set(landmark.id, landmark.nombre)
  }

  const buildings = mergeById(
    landmarks.flatMap((landmark) =>
      (landmark.edificios ?? []).map((building) => ({
        ...building,
        landmarkId: building.landmarkId ?? landmark.id,
      })),
    ),
    await fetchBuildings().catch(() => []),
  )

  const characters = mergeById(
    landmarks.flatMap((landmark) =>
      (landmark.personajes ?? []).map((character) => ({
        ...character,
        landmarkId: character.landmarkId ?? landmark.id,
      })),
    ),
    await fetchCharacters().catch(() => []),
  )

  const organizations = await fetchOrganizations().catch(() => [])

  const buildingNameById = new Map<number, string>()
  for (const building of buildings) {
    buildingNameById.set(building.id, building.nombre)
  }

  const organizationNameById = new Map<number, string>()
  for (const organization of organizations) {
    organizationNameById.set(organization.id, organization.nombre)
  }

  return {
    landmarksById: new Map(landmarks.map((item) => [item.id, item])),
    buildingsById: new Map(buildings.map((item) => [item.id, item])),
    charactersById: new Map(characters.map((item) => [item.id, item])),
    organizationsById: new Map(organizations.map((item) => [item.id, item])),
    landmarkNameById,
    buildingNameById,
    organizationNameById,
  }
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

function formatEventTimestamp(value?: string) {
  if (!value) return null

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null

  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed)
}

function NotasPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const notesSubnavConfig = getSubnavConfig("/notas")
  const activeSection = (notesSubnavConfig
    ? getSubnavActiveValue(notesSubnavConfig, searchParams.get("section"))
    : "dm-notes") as NotesSection

  const [notes, setNotes] = useState("")
  const [hasLoadedNotes, setHasLoadedNotes] = useState(false)
  const [notesStatus, setNotesStatus] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  const lastSavedNotesRef = useRef("")
  const saveRequestIdRef = useRef(0)

  const [events, setEvents] = useState<DmEvent[]>([])
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [isEventsLoading, setIsEventsLoading] = useState(true)
  const [deleteTargetEvent, setDeleteTargetEvent] = useState<DmEvent | null>(null)
  const [isDeletingEvent, setIsDeletingEvent] = useState(false)

  const [selectedLandmarkDetail, setSelectedLandmarkDetail] = useState<Landmark | null>(null)
  const [selectedBuildingDetailId, setSelectedBuildingDetailId] = useState<number | null>(null)
  const [selectedCharacterDetail, setSelectedCharacterDetail] = useState<CharacterDetailData | null>(null)
  const [selectedOrganizationDetail, setSelectedOrganizationDetail] = useState<Organization | null>(null)
  const [detailLandmarkNameById, setDetailLandmarkNameById] = useState<Map<number, string>>(() => new Map())
  const [detailBuildingNameById, setDetailBuildingNameById] = useState<Map<number, string>>(() => new Map())
  const [detailOrganizationNameById, setDetailOrganizationNameById] = useState<Map<number, string>>(() => new Map())

  useEffect(() => {
    if (!notesSubnavConfig) {
      return
    }

    const currentSection = searchParams.get("section")
    const normalizedSection = getSubnavActiveValue(notesSubnavConfig, currentSection)
    if (currentSection === normalizedSection) {
      return
    }

    router.replace(`/notas?section=${encodeURIComponent(normalizedSection)}`)
  }, [notesSubnavConfig, router, searchParams])

  useEffect(() => {
    let isCancelled = false

    fetchDmNotes()
      .then((storedNotes) => {
        if (isCancelled) return
        setNotes(storedNotes)
        lastSavedNotesRef.current = storedNotes
        setHasLoadedNotes(true)
        setNotesStatus(null)
      })
      .catch((error) => {
        if (isCancelled) return
        lastSavedNotesRef.current = ""
        setHasLoadedNotes(true)
        setNotesStatus(getBackendErrorMessage(error, "No se pudieron cargar las notas del backend."))
      })

    return () => {
      isCancelled = true
    }
  }, [])

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

  const handleNotesChange = useCallback((value: string) => {
    setNotes(value)
    setNotesStatus(null)
  }, [])

  useEffect(() => {
    if (!hasLoadedNotes) return
    if (notes === lastSavedNotesRef.current) return

    const requestId = saveRequestIdRef.current + 1
    saveRequestIdRef.current = requestId

    const timeoutId = window.setTimeout(() => {
      setNotesStatus("Guardando...")

      updateDmNotes(notes)
        .then((savedNotes) => {
          if (saveRequestIdRef.current !== requestId) return
          lastSavedNotesRef.current = savedNotes
          setNotes((currentNotes) => (currentNotes === notes ? savedNotes : currentNotes))
          setNotesStatus(null)
        })
        .catch((error) => {
          if (saveRequestIdRef.current !== requestId) return
          setNotesStatus(getBackendErrorMessage(error, "No se pudieron guardar las notas."))
        })
    }, DM_NOTES_SAVE_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [hasLoadedNotes, notes])

  useEffect(() => {
    if (!isEditing || activeSection !== "dm-notes") return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target || !editorContainerRef.current) return
      if (!editorContainerRef.current.contains(target)) {
        setIsEditing(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [activeSection, isEditing])

  useEffect(() => {
    if (!isEditing || activeSection !== "dm-notes") return

    const frameId = requestAnimationFrame(() => {
      const textarea = editorContainerRef.current?.querySelector("textarea")
      textarea?.focus()
    })

    return () => cancelAnimationFrame(frameId)
  }, [activeSection, isEditing])

  const resolveLandmarkName = useCallback(
    (landmarkId: number) => detailLandmarkNameById.get(landmarkId) ?? "Desconocido",
    [detailLandmarkNameById],
  )

  const resolveBuildingName = useCallback(
    (buildingId: number) => detailBuildingNameById.get(buildingId) ?? "Desconocido",
    [detailBuildingNameById],
  )

  const resolveOrganizationName = useCallback(
    (organizationId: number) => detailOrganizationNameById.get(organizationId) ?? "Desconocido",
    [detailOrganizationNameById],
  )

  const handleOpenMention = useCallback(async (mention: MentionRef) => {
    if (!mention.type || typeof mention.id !== "number") return

    const referenceIndexes = await buildReferenceIndexes()
    setDetailLandmarkNameById(referenceIndexes.landmarkNameById)
    setDetailBuildingNameById(referenceIndexes.buildingNameById)
    setDetailOrganizationNameById(referenceIndexes.organizationNameById)

    setSelectedLandmarkDetail(null)
    setSelectedBuildingDetailId(null)
    setSelectedCharacterDetail(null)
    setSelectedOrganizationDetail(null)

    if (mention.type === "landmark") {
      const selectedLandmark = referenceIndexes.landmarksById.get(mention.id)
      if (selectedLandmark) setSelectedLandmarkDetail(selectedLandmark)
      return
    }

    if (mention.type === "building") {
      const selectedBuilding = referenceIndexes.buildingsById.get(mention.id)
      if (selectedBuilding) setSelectedBuildingDetailId(selectedBuilding.id)
      return
    }

    if (mention.type === "character") {
      const selectedCharacter = referenceIndexes.charactersById.get(mention.id)
      if (!selectedCharacter) return

      setSelectedCharacterDetail({
        character: selectedCharacter,
        landmarkName: referenceIndexes.landmarkNameById.get(selectedCharacter.landmarkId) ?? "Desconocido",
        buildingNames: selectedCharacter.buildingIds.map(
          (buildingId) => referenceIndexes.buildingNameById.get(buildingId) ?? "Desconocido",
        ),
        organizationNames: selectedCharacter.organizationIds.map(
          (organizationId) => referenceIndexes.organizationNameById.get(organizationId) ?? "Desconocido",
        ),
      })
      return
    }

    if (mention.type === "organization") {
      const selectedOrganization = referenceIndexes.organizationsById.get(mention.id)
      if (selectedOrganization) setSelectedOrganizationDetail(selectedOrganization)
    }
  }, [])

  const pageTitle = useMemo(() => (activeSection === "dm-events" ? "Eventos DM" : "Notas DM"), [activeSection])

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
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-primary">DM</h1>
          <p className="mt-1 text-sm text-muted-foreground">{pageTitle}</p>
        </div>

        {activeSection === "dm-notes" ? (
          <Button type="button" variant="outline" onClick={() => setIsEditing((prevState) => !prevState)}>
            {isEditing ? "Ver menciones" : "Editar notas"}
          </Button>
        ) : (
          <Button type="button" onClick={openCreateDmEventDialog}>
            Agregar Evento
          </Button>
        )}
      </div>

      {activeSection === "dm-notes" ? (
        <>
          {notesStatus ? <p className="mb-3 text-sm text-muted-foreground">{notesStatus}</p> : null}

          {isEditing ? (
            <div ref={editorContainerRef}>
              <MentionField
                source="auto"
                value={notes}
                onChange={handleNotesChange}
                placeholder="Escribe tus notas del DM aqui..."
                rows={18}
              />
            </div>
          ) : (
            <div
              className="min-h-[340px] rounded-md border border-border bg-background p-3 text-sm"
              onClick={(event) => {
                const target = event.target as HTMLElement | null
                if (target?.closest(".mention-inline-link")) return
                setIsEditing(true)
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.currentTarget !== event.target) return
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  setIsEditing(true)
                }
              }}
            >
              <MentionField
                source="auto"
                value={notes}
                editable={false}
                emptyText="No hay notas todavia. Haz click para escribir."
                onOpenMention={handleOpenMention}
              />
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {eventsError ? <p className="text-sm text-destructive">{eventsError}</p> : null}

          {isEventsLoading ? (
            <div className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
              Cargando eventos...
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-background/80 p-6 text-sm text-muted-foreground">
              No hay eventos todavia. Usa <span className="font-semibold">Alt+E</span> para agregar uno.
            </div>
          ) : (
            events.map((eventItem) => {
              const timestamp = formatEventTimestamp(eventItem.createdAt)

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
                    onOpenMention={handleOpenMention}
                    className="text-sm leading-relaxed"
                  />
                </article>
              )
            })
          )}
        </div>
      )}

      <LandmarkDetailDialog
        landmarkId={selectedLandmarkDetail?.id}
        open={Boolean(selectedLandmarkDetail)}
        onOpenChange={(open) => {
          if (!open) setSelectedLandmarkDetail(null)
        }}
        onLandmarkUpdated={(updatedLandmark) => {
          setSelectedLandmarkDetail(updatedLandmark)
          setDetailLandmarkNameById((previous) => {
            const next = new Map(previous)
            next.set(updatedLandmark.id, updatedLandmark.nombre)
            return next
          })
        }}
      />

      <BuildingDetailDialog
        buildingId={selectedBuildingDetailId}
        open={selectedBuildingDetailId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedBuildingDetailId(null)
        }}
        resolveLandmarkName={resolveLandmarkName}
        resolveOrganizationName={resolveOrganizationName}
        onBuildingUpdated={(updatedBuilding) => {
          setSelectedBuildingDetailId(updatedBuilding.id)
          setDetailBuildingNameById((previous) => {
            const next = new Map(previous)
            next.set(updatedBuilding.id, updatedBuilding.nombre)
            return next
          })
        }}
      />

      <CharacterDetailDialog
        characterId={selectedCharacterDetail?.character.id}
        open={Boolean(selectedCharacterDetail)}
        onOpenChange={(open) => {
          if (!open) setSelectedCharacterDetail(null)
        }}
        initialLandmarkId={selectedCharacterDetail?.character.landmarkId}
        onCharacterUpdated={(updatedCharacter) => {
          setSelectedCharacterDetail({
            character: updatedCharacter,
            landmarkName: detailLandmarkNameById.get(updatedCharacter.landmarkId) ?? "Desconocido",
            buildingNames: updatedCharacter.buildingIds.map(
              (buildingId) => detailBuildingNameById.get(buildingId) ?? "Desconocido",
            ),
            organizationNames: updatedCharacter.organizationIds.map(
              (organizationId) => detailOrganizationNameById.get(organizationId) ?? "Desconocido",
            ),
          })
        }}
      />

      <OrganizationDetailDialog
        organizationId={selectedOrganizationDetail?.id}
        open={Boolean(selectedOrganizationDetail)}
        onOpenChange={(open) => {
          if (!open) setSelectedOrganizationDetail(null)
        }}
        resolveBuildingName={resolveBuildingName}
        resolveLandmarkName={resolveLandmarkName}
        initialLandmarkId={selectedOrganizationDetail?.landmarks[0]}
        onOrganizationUpdated={(updatedOrganization) => {
          setSelectedOrganizationDetail(updatedOrganization)
          setDetailOrganizationNameById((previous) => {
            const next = new Map(previous)
            next.set(updatedOrganization.id, updatedOrganization.nombre)
            return next
          })
        }}
      />

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
    </div>
  )
}

export default function NotasPage() {
  return (
    <Suspense fallback={null}>
      <NotasPageContent />
    </Suspense>
  )
}
