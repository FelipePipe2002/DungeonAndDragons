import { useCallback, useRef, useState } from "react"

import type { CharacterDetailData } from "@/components/dialog/detailed/CharacterDetailDialog"
import type { MentionRef } from "@/components/mentionField/MentionField"
import { UNKNOWN_LABEL } from "@/lib/display"
import { buildReferenceIndexes, type ReferenceIndexes } from "@/lib/dm/reference-indexes"
import type { Building, Character, Landmark, Organization } from "@/lib/types"

export function useDmMentionDetails() {
  const referenceIndexesRef = useRef<ReferenceIndexes | null>(null)
  const referenceIndexesPromiseRef = useRef<Promise<ReferenceIndexes> | null>(null)
  const [selectedLandmarkDetail, setSelectedLandmarkDetail] = useState<Landmark | null>(null)
  const [selectedEstadoDetailId, setSelectedEstadoDetailId] = useState<number | null>(null)
  const [selectedBuildingDetailId, setSelectedBuildingDetailId] = useState<number | null>(null)
  const [selectedCharacterDetail, setSelectedCharacterDetail] = useState<CharacterDetailData | null>(null)
  const [selectedOrganizationDetail, setSelectedOrganizationDetail] = useState<Organization | null>(null)
  const [detailLandmarkNameById, setDetailLandmarkNameById] = useState<Map<number, string>>(() => new Map())
  const [detailBuildingNameById, setDetailBuildingNameById] = useState<Map<number, string>>(() => new Map())
  const [detailOrganizationNameById, setDetailOrganizationNameById] = useState<Map<number, string>>(() => new Map())

  const resetSelections = useCallback(() => {
    setSelectedLandmarkDetail(null)
    setSelectedEstadoDetailId(null)
    setSelectedBuildingDetailId(null)
    setSelectedCharacterDetail(null)
    setSelectedOrganizationDetail(null)
  }, [])

  const getReferenceIndexes = useCallback(async () => {
    if (referenceIndexesRef.current) {
      return referenceIndexesRef.current
    }

    if (!referenceIndexesPromiseRef.current) {
      referenceIndexesPromiseRef.current = buildReferenceIndexes()
        .then((indexes) => {
          referenceIndexesRef.current = indexes
          return indexes
        })
        .finally(() => {
          referenceIndexesPromiseRef.current = null
        })
    }

    return referenceIndexesPromiseRef.current
  }, [])

  const updateReferenceMaps = useCallback((updater: (indexes: ReferenceIndexes) => void) => {
    const indexes = referenceIndexesRef.current
    if (!indexes) return
    updater(indexes)
  }, [])

  const updateLandmarkReference = useCallback((updatedLandmark: Landmark) => {
    setDetailLandmarkNameById((previous) => {
      const next = new Map(previous)
      next.set(updatedLandmark.id, updatedLandmark.nombre)
      return next
    })

    updateReferenceMaps((indexes) => {
      indexes.landmarksById.set(updatedLandmark.id, updatedLandmark)
      indexes.landmarkNameById.set(updatedLandmark.id, updatedLandmark.nombre)
    })
  }, [updateReferenceMaps])

  const updateBuildingReference = useCallback((updatedBuilding: Building) => {
    setDetailBuildingNameById((previous) => {
      const next = new Map(previous)
      next.set(updatedBuilding.id, updatedBuilding.nombre)
      return next
    })

    updateReferenceMaps((indexes) => {
      indexes.buildingsById.set(updatedBuilding.id, updatedBuilding)
      indexes.buildingNameById.set(updatedBuilding.id, updatedBuilding.nombre)
    })
  }, [updateReferenceMaps])

  const updateCharacterReference = useCallback((updatedCharacter: Character) => {
    updateReferenceMaps((indexes) => {
      indexes.charactersById.set(updatedCharacter.id, updatedCharacter)
    })
  }, [updateReferenceMaps])

  const updateOrganizationReference = useCallback((updatedOrganization: Organization) => {
    setDetailOrganizationNameById((previous) => {
      const next = new Map(previous)
      next.set(updatedOrganization.id, updatedOrganization.nombre)
      return next
    })

    updateReferenceMaps((indexes) => {
      indexes.organizationsById.set(updatedOrganization.id, updatedOrganization)
      indexes.organizationNameById.set(updatedOrganization.id, updatedOrganization.nombre)
    })
  }, [updateReferenceMaps])

  const handleOpenMention = useCallback(async (mention: MentionRef) => {
    if (!mention.type || typeof mention.id !== "number") return

    const referenceIndexes = await getReferenceIndexes()
    setDetailLandmarkNameById(referenceIndexes.landmarkNameById)
    setDetailBuildingNameById(referenceIndexes.buildingNameById)
    setDetailOrganizationNameById(referenceIndexes.organizationNameById)

    resetSelections()

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
        landmarkName: referenceIndexes.landmarkNameById.get(selectedCharacter.landmarkId) ?? UNKNOWN_LABEL,
        buildingNames: selectedCharacter.buildingIds.map(
          (buildingId) => referenceIndexes.buildingNameById.get(buildingId) ?? UNKNOWN_LABEL,
        ),
        organizationNames: selectedCharacter.organizationIds.map(
          (organizationId) => referenceIndexes.organizationNameById.get(organizationId) ?? UNKNOWN_LABEL,
        ),
      })
      return
    }

    if (mention.type === "organization") {
      const selectedOrganization = referenceIndexes.organizationsById.get(mention.id)
      if (selectedOrganization) setSelectedOrganizationDetail(selectedOrganization)
    }
  }, [getReferenceIndexes, resetSelections])

  return {
    detailBuildingNameById,
    detailLandmarkNameById,
    detailOrganizationNameById,
    handleOpenMention,
    selectedBuildingDetailId,
    selectedCharacterDetail,
    selectedEstadoDetailId,
    selectedLandmarkDetail,
    selectedOrganizationDetail,
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
