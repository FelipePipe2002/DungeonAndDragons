import { useCallback, useEffect, useMemo, useState } from "react"

import type { CharacterDetailData } from "@/components/dialog/detailed/CharacterDetailDialog"
import type { MentionRef } from "@/components/mentionField/MentionField"
import { UNKNOWN_LABEL } from "@/lib/display"
import { buildReferenceIndexes } from "@/lib/landmarks/reference-indexes"
import type { Building, Character, Landmark, Organization } from "@/lib/types"

type UseLandmarkMentionDetailsProps = {
  allLandmarks: Landmark[]
  currentLandmark: Landmark | null
  storedBuildings: Building[]
  storedCharacters: Character[]
  storedOrganizations: Organization[]
}

export function useLandmarkMentionDetails({
  allLandmarks,
  currentLandmark,
  storedBuildings,
  storedCharacters,
  storedOrganizations,
}: UseLandmarkMentionDetailsProps) {
  const referenceIndexes = useMemo(
    () => buildReferenceIndexes(allLandmarks, currentLandmark, storedBuildings, storedCharacters, storedOrganizations),
    [allLandmarks, currentLandmark, storedBuildings, storedCharacters, storedOrganizations],
  )

  const [selectedLandmarkDetail, setSelectedLandmarkDetail] = useState<Landmark | null>(null)
  const [selectedEstadoDetailId, setSelectedEstadoDetailId] = useState<number | null>(null)
  const [selectedBuildingDetailId, setSelectedBuildingDetailId] = useState<number | null>(null)
  const [isBuildingDialogOpen, setIsBuildingDialogOpen] = useState(false)
  const [selectedCharacterDetail, setSelectedCharacterDetail] = useState<CharacterDetailData | null>(null)
  const [isCharacterDialogOpen, setIsCharacterDialogOpen] = useState(false)
  const [selectedOrganizationDetail, setSelectedOrganizationDetail] = useState<Organization | null>(null)
  const [isOrganizationDialogOpen, setIsOrganizationDialogOpen] = useState(false)
  const [detailLandmarkNameById, setDetailLandmarkNameById] = useState<Map<number, string>>(() => new Map())
  const [detailBuildingNameById, setDetailBuildingNameById] = useState<Map<number, string>>(() => new Map())
  const [detailOrganizationNameById, setDetailOrganizationNameById] = useState<Map<number, string>>(() => new Map())

  useEffect(() => {
    setDetailLandmarkNameById(referenceIndexes.landmarkNameById)
    setDetailBuildingNameById(referenceIndexes.buildingNameById)
    setDetailOrganizationNameById(referenceIndexes.organizationNameById)
  }, [referenceIndexes])

  useEffect(() => {
    setSelectedLandmarkDetail(null)
    setSelectedEstadoDetailId(null)
    setSelectedBuildingDetailId(null)
    setIsBuildingDialogOpen(false)
    setSelectedCharacterDetail(null)
    setIsCharacterDialogOpen(false)
    setSelectedOrganizationDetail(null)
    setIsOrganizationDialogOpen(false)
  }, [currentLandmark?.id])

  const resetDetails = useCallback(() => {
    setSelectedLandmarkDetail(null)
    setSelectedEstadoDetailId(null)
    setSelectedBuildingDetailId(null)
    setIsBuildingDialogOpen(false)
    setSelectedCharacterDetail(null)
    setIsCharacterDialogOpen(false)
    setSelectedOrganizationDetail(null)
    setIsOrganizationDialogOpen(false)
  }, [])

  const handleOpenMention = useCallback((mention: MentionRef) => {
    if (!mention.type || typeof mention.id !== "number") return

    resetDetails()

    if (mention.type === "landmark") {
      const selected = referenceIndexes.landmarksById.get(mention.id)
      if (selected) setSelectedLandmarkDetail(selected)
      return
    }

    if (mention.type === "building") {
      const selected = referenceIndexes.buildingsById.get(mention.id)
      if (selected) {
        setSelectedBuildingDetailId(selected.id)
        setIsBuildingDialogOpen(true)
      }
      return
    }

    if (mention.type === "estado") {
      setSelectedEstadoDetailId(mention.id)
      return
    }

    if (mention.type === "character") {
      const selected = referenceIndexes.charactersById.get(mention.id)
      if (!selected) return

      setSelectedCharacterDetail({
        character: selected,
        landmarkName: referenceIndexes.landmarkNameById.get(selected.landmarkId) ?? UNKNOWN_LABEL,
        buildingNames: selected.buildingIds.map(
          (buildingId) => referenceIndexes.buildingNameById.get(buildingId) ?? UNKNOWN_LABEL,
        ),
        organizationNames: selected.organizationIds.map(
          (organizationId) => referenceIndexes.organizationNameById.get(organizationId) ?? UNKNOWN_LABEL,
        ),
      })
      setIsCharacterDialogOpen(true)
      return
    }

    if (mention.type === "organization") {
      const selected = referenceIndexes.organizationsById.get(mention.id)
      if (selected) {
        setSelectedOrganizationDetail(selected)
        setIsOrganizationDialogOpen(true)
      }
    }
  }, [referenceIndexes, resetDetails])

  const updateLandmarkReference = useCallback((updatedLandmark: Landmark) => {
    setSelectedLandmarkDetail(updatedLandmark)
    setDetailLandmarkNameById((prev) => {
      const next = new Map(prev)
      next.set(updatedLandmark.id, updatedLandmark.nombre)
      return next
    })
  }, [])

  const updateBuildingReference = useCallback((updatedBuilding: Building) => {
    setSelectedBuildingDetailId(updatedBuilding.id)
    setIsBuildingDialogOpen(true)
    setDetailBuildingNameById((prev) => {
      const next = new Map(prev)
      next.set(updatedBuilding.id, updatedBuilding.nombre)
      return next
    })
  }, [])

  const updateCharacterReference = useCallback((updatedCharacter: Character) => {
    setSelectedCharacterDetail({
      character: updatedCharacter,
      landmarkName: detailLandmarkNameById.get(updatedCharacter.landmarkId) ?? UNKNOWN_LABEL,
      buildingNames: updatedCharacter.buildingIds.map(
        (buildingId) => detailBuildingNameById.get(buildingId) ?? UNKNOWN_LABEL,
      ),
      organizationNames: updatedCharacter.organizationIds.map(
        (organizationId) => detailOrganizationNameById.get(organizationId) ?? UNKNOWN_LABEL,
      ),
    })
    setIsCharacterDialogOpen(true)
  }, [detailBuildingNameById, detailLandmarkNameById, detailOrganizationNameById])

  const updateOrganizationReference = useCallback((updatedOrganization: Organization) => {
    setSelectedOrganizationDetail(updatedOrganization)
    setIsOrganizationDialogOpen(true)
    setDetailOrganizationNameById((prev) => {
      const next = new Map(prev)
      next.set(updatedOrganization.id, updatedOrganization.nombre)
      return next
    })
  }, [])

  return {
    detailBuildingNameById,
    detailLandmarkNameById,
    detailOrganizationNameById,
    handleOpenMention,
    isBuildingDialogOpen,
    isCharacterDialogOpen,
    isOrganizationDialogOpen,
    selectedBuildingDetailId,
    selectedCharacterDetail,
    selectedEstadoDetailId,
    selectedLandmarkDetail,
    selectedOrganizationDetail,
    setIsBuildingDialogOpen,
    setIsCharacterDialogOpen,
    setIsOrganizationDialogOpen,
    setSelectedBuildingDetailId,
    setSelectedCharacterDetail,
    setSelectedEstadoDetailId,
    setSelectedLandmarkDetail,
    setSelectedOrganizationDetail,
    updateBuildingReference,
    updateCharacterReference,
    updateLandmarkReference,
    updateOrganizationReference,
  }
}

export type LandmarkMentionDetails = ReturnType<typeof useLandmarkMentionDetails>
