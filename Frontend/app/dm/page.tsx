"use client"

import dynamic from "next/dynamic"
import { Suspense, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { fetchBuildings } from "@/lib/services/building-api.service"
import { fetchCharacters } from "@/lib/services/character-api.service"
import { fetchLandmarks } from "@/lib/services/landmark-api.service"
import { getSubnavActiveValue, getSubnavConfig } from "@/lib/navigation/subnav"
import { fetchOrganizations } from "@/lib/services/organization-api.service"
import type { Building, Character, Landmark, Organization } from "@/lib/types"
import type { CharacterDetailData } from "@/components/dialog/detailed/CharacterDetailDialog"
import type { MentionRef } from "@/components/mentionField/MentionField"

const BuildingDetailDialog = dynamic(() =>
  import("@/components/dialog/detailed/BuildingDetailDialog").then((mod) => mod.BuildingDetailDialog),
)
const CharacterDetailDialog = dynamic(() =>
  import("@/components/dialog/detailed/CharacterDetailDialog").then((mod) => mod.CharacterDetailDialog),
)
const EstadoDetailDialog = dynamic(() =>
  import("@/components/dialog/detailed/EstadoDetailDialog").then((mod) => mod.EstadoDetailDialog),
)
const LandmarkDetailDialog = dynamic(() =>
  import("@/components/dialog/detailed/LandmarkDetailDialog").then((mod) => mod.LandmarkDetailDialog),
)
const OrganizationDetailDialog = dynamic(() =>
  import("@/components/dialog/detailed/OrganizationDetailDialog").then((mod) => mod.OrganizationDetailDialog),
)

const DmNotesSection = dynamic(() => import("@/app/dm/sections/DmNotesSection"))
const OpenLoopsSection = dynamic(() =>
  import("@/components/dm/OpenLoopsSection").then((mod) => mod.OpenLoopsSection),
)
const DmEventsSection = dynamic(() => import("@/app/dm/sections/DmEventsSection"))
const DmRelationshipsSection = dynamic(() =>
  import("@/components/dm/DmRelationshipsSection").then((mod) => mod.DmRelationshipsSection),
)
const PartyInventorySection = dynamic(() =>
  import("@/components/dm/PartyInventorySection").then((mod) => mod.PartyInventorySection),
)

type DmSection = "dm-notes" | "open-loops" | "dm-events" | "dm-relationships" | "party-inventory"

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

function DmPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dmSubnavConfig = getSubnavConfig("/dm")
  const activeSection = (dmSubnavConfig
    ? getSubnavActiveValue(dmSubnavConfig, searchParams.get("section"))
    : "dm-notes") as DmSection

  const [selectedLandmarkDetail, setSelectedLandmarkDetail] = useState<Landmark | null>(null)
  const [selectedEstadoDetailId, setSelectedEstadoDetailId] = useState<number | null>(null)
  const [selectedBuildingDetailId, setSelectedBuildingDetailId] = useState<number | null>(null)
  const [selectedCharacterDetail, setSelectedCharacterDetail] = useState<CharacterDetailData | null>(null)
  const [selectedOrganizationDetail, setSelectedOrganizationDetail] = useState<Organization | null>(null)
  const [detailLandmarkNameById, setDetailLandmarkNameById] = useState<Map<number, string>>(() => new Map())
  const [detailBuildingNameById, setDetailBuildingNameById] = useState<Map<number, string>>(() => new Map())
  const [detailOrganizationNameById, setDetailOrganizationNameById] = useState<Map<number, string>>(() => new Map())

  useEffect(() => {
    if (!dmSubnavConfig) return

    const currentSection = searchParams.get("section")
    const normalizedSection = getSubnavActiveValue(dmSubnavConfig, currentSection)
    if (currentSection === normalizedSection) return

    router.replace(`/dm?section=${encodeURIComponent(normalizedSection)}`)
  }, [dmSubnavConfig, router, searchParams])

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
    setSelectedEstadoDetailId(null)
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

    if (mention.type === "estado") {
      setSelectedEstadoDetailId(mention.id)
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

  const renderActiveSection = () => {
    if (activeSection === "open-loops") return <OpenLoopsSection />
    if (activeSection === "dm-events") return <DmEventsSection onOpenMention={handleOpenMention} />
    if (activeSection === "dm-relationships") return <DmRelationshipsSection />
    if (activeSection === "party-inventory") return <PartyInventorySection />
    return <DmNotesSection onOpenMention={handleOpenMention} />
  }

  const pageTitle = (() => {
    if (activeSection === "open-loops") return "Open Loops"
    if (activeSection === "dm-relationships") return "Relaciones"
    if (activeSection === "party-inventory") return "Party Inventory"
    return null
  })()

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      {pageTitle ? (
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif text-primary">DM</h1>
            <p className="mt-1 text-sm text-muted-foreground">{pageTitle}</p>
          </div>
        </div>
      ) : null}

      {renderActiveSection()}

      {selectedLandmarkDetail ? (
        <LandmarkDetailDialog
          landmarkId={selectedLandmarkDetail.id}
          open
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
      ) : null}

      {selectedEstadoDetailId !== null ? (
        <EstadoDetailDialog
          estadoId={selectedEstadoDetailId}
          open
          onOpenChange={(open) => {
            if (!open) setSelectedEstadoDetailId(null)
          }}
          onEstadoUpdated={(updatedEstado) => {
            setSelectedEstadoDetailId(updatedEstado.id)
          }}
          onOpenEstado={(nextEstadoId) => {
            setSelectedEstadoDetailId(nextEstadoId)
          }}
          onOpenCharacter={(characterId) => {
            void handleOpenMention({ type: "character", id: characterId, label: "" })
          }}
          onOpenLandmark={(landmarkId) => {
            void handleOpenMention({ type: "landmark", id: landmarkId, label: "" })
          }}
        />
      ) : null}

      {selectedBuildingDetailId !== null ? (
        <BuildingDetailDialog
          buildingId={selectedBuildingDetailId}
          open
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
      ) : null}

      {selectedCharacterDetail ? (
        <CharacterDetailDialog
          characterId={selectedCharacterDetail.character.id}
          open
          onOpenChange={(open) => {
            if (!open) setSelectedCharacterDetail(null)
          }}
          initialLandmarkId={selectedCharacterDetail.character.landmarkId}
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
      ) : null}

      {selectedOrganizationDetail ? (
        <OrganizationDetailDialog
          organizationId={selectedOrganizationDetail.id}
          open
          onOpenChange={(open) => {
            if (!open) setSelectedOrganizationDetail(null)
          }}
          resolveBuildingName={resolveBuildingName}
          resolveLandmarkName={resolveLandmarkName}
          initialLandmarkId={selectedOrganizationDetail.landmarks[0]}
          onOrganizationUpdated={(updatedOrganization) => {
            setSelectedOrganizationDetail(updatedOrganization)
            setDetailOrganizationNameById((previous) => {
              const next = new Map(previous)
              next.set(updatedOrganization.id, updatedOrganization.nombre)
              return next
            })
          }}
        />
      ) : null}
    </div>
  )
}

export default function DmPage() {
  return (
    <Suspense fallback={null}>
      <DmPageContent />
    </Suspense>
  )
}
