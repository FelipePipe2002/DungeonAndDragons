"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { BuildingDetailDialog } from "@/components/dialog/detailed/BuildingDetailDialog"
import { CharacterDetailDialog, type CharacterDetailData } from "@/components/dialog/detailed/CharacterDetailDialog"
import { LandmarkDetailDialog } from "@/components/dialog/detailed/LandmarkDetailDialog"
import { OrganizationDetailDialog } from "@/components/dialog/detailed/OrganizationDetailDialog"
import { MentionField, type MentionRef } from "@/components/mentionField/MentionField"
import { Button } from "@/components/ui/button"
import { fetchCharacters } from "@/lib/services/character-api.service"
import { fetchBuildings } from "@/lib/services/building-api.service"
import { fetchDmNotes, updateDmNotes } from "@/lib/services/dm-notes-api.service"
import { fetchLandmarks } from "@/lib/services/landmark-api.service"
import { fetchOrganizations } from "@/lib/services/organization-api.service"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import type { Building, Character, Landmark, Organization } from "@/lib/types"

const DM_NOTES_SAVE_DEBOUNCE_MS = 450

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

export default function NotasPage() {
  const [notes, setNotes] = useState("")
  const [hasLoadedNotes, setHasLoadedNotes] = useState(false)
  const [notesStatus, setNotesStatus] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  const lastSavedNotesRef = useRef("")
  const saveRequestIdRef = useRef(0)
  const [selectedLandmarkDetail, setSelectedLandmarkDetail] = useState<Landmark | null>(null)
  const [selectedBuildingDetailId, setSelectedBuildingDetailId] = useState<number | null>(null)
  const [selectedCharacterDetail, setSelectedCharacterDetail] = useState<CharacterDetailData | null>(null)
  const [selectedOrganizationDetail, setSelectedOrganizationDetail] = useState<Organization | null>(null)
  const [detailLandmarkNameById, setDetailLandmarkNameById] = useState<Map<number, string>>(() => new Map())
  const [detailBuildingNameById, setDetailBuildingNameById] = useState<Map<number, string>>(() => new Map())
  const [detailOrganizationNameById, setDetailOrganizationNameById] = useState<Map<number, string>>(
    () => new Map(),
  )

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
    if (!isEditing) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target || !editorContainerRef.current) return
      if (!editorContainerRef.current.contains(target)) {
        setIsEditing(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [isEditing])

  useEffect(() => {
    if (!isEditing) return

    const frameId = requestAnimationFrame(() => {
      const textarea = editorContainerRef.current?.querySelector("textarea")
      textarea?.focus()
    })

    return () => cancelAnimationFrame(frameId)
  }, [isEditing])

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
        landmarkName:
          referenceIndexes.landmarkNameById.get(selectedCharacter.landmarkId) ?? "Desconocido",
        buildingNames: selectedCharacter.buildingIds.map(
          (buildingId) => referenceIndexes.buildingNameById.get(buildingId) ?? "Desconocido",
        ),
        organizationNames: selectedCharacter.organizationIds.map(
          (organizationId) =>
            referenceIndexes.organizationNameById.get(organizationId) ?? "Desconocido",
        ),
      })
      return
    }

    if (mention.type === "organization") {
      const selectedOrganization = referenceIndexes.organizationsById.get(mention.id)
      if (selectedOrganization) setSelectedOrganizationDetail(selectedOrganization)
    }
  }, [])

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-serif text-primary">Notas DM</h1>
      </div>

      <div className="mb-3 flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsEditing((prevState) => !prevState)}
        >
          {isEditing ? "Ver menciones" : "Editar notas"}
        </Button>
      </div>

      {notesStatus ? (
        <p className="mb-3 text-sm text-muted-foreground">{notesStatus}</p>
      ) : null}

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
              (organizationId) =>
                detailOrganizationNameById.get(organizationId) ?? "Desconocido",
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
    </div>
  )
}
