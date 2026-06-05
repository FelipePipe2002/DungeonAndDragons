import dynamic from "next/dynamic"

import type { MentionRef } from "@/components/mentionField/MentionField"
import type { useDmMentionDetails } from "@/hooks/useDmMentionDetails"
import { UNKNOWN_LABEL } from "@/lib/display"

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

type DmMentionDetailsState = ReturnType<typeof useDmMentionDetails>

type DmMentionDetailDialogsProps = {
  mentionDetails: DmMentionDetailsState
}

export function DmMentionDetailDialogs({ mentionDetails }: DmMentionDetailDialogsProps) {
  const {
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
  } = mentionDetails

  return (
    <>
      {selectedLandmarkDetail ? (
        <LandmarkDetailDialog
          landmarkId={selectedLandmarkDetail.id}
          open
          onOpenChange={(open) => {
            if (!open) setSelectedLandmarkDetail(null)
          }}
          onLandmarkUpdated={(updatedLandmark) => {
            setSelectedLandmarkDetail(updatedLandmark)
            updateLandmarkReference(updatedLandmark)
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
            void handleOpenMention({ type: "character", id: characterId, label: "" } satisfies MentionRef)
          }}
          onOpenLandmark={(landmarkId) => {
            void handleOpenMention({ type: "landmark", id: landmarkId, label: "" } satisfies MentionRef)
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
          onBuildingUpdated={(updatedBuilding) => {
            setSelectedBuildingDetailId(updatedBuilding.id)
            updateBuildingReference(updatedBuilding)
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
            updateCharacterReference(updatedCharacter)
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
          initialLandmarkId={selectedOrganizationDetail.landmarks[0]}
          onOrganizationUpdated={(updatedOrganization) => {
            setSelectedOrganizationDetail(updatedOrganization)
            updateOrganizationReference(updatedOrganization)
          }}
        />
      ) : null}
    </>
  )
}
