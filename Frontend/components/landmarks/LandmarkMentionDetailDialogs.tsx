import { BuildingDetailDialog } from "@/components/dialog/detailed/BuildingDetailDialog"
import { CharacterDetailDialog } from "@/components/dialog/detailed/CharacterDetailDialog"
import { EstadoDetailDialog } from "@/components/dialog/detailed/EstadoDetailDialog"
import { LandmarkDetailDialog } from "@/components/dialog/detailed/LandmarkDetailDialog"
import { OrganizationDetailDialog } from "@/components/dialog/detailed/OrganizationDetailDialog"
import type { MentionRef } from "@/components/mentionField/MentionField"
import type { LandmarkMentionDetails } from "@/hooks/useLandmarkMentionDetails"
import type { Building, Character, Estado, Landmark, Organization } from "@/lib/types"

type LandmarkMentionDetailDialogsProps = {
  landmarkId: number
  mentionDetails: LandmarkMentionDetails
  onBuildingUpdated: (building: Building) => void
  onCharacterUpdated: (character: Character) => void
  onLandmarkUpdated: (landmark: Landmark) => void
  onOpenMention: (mention: MentionRef) => void
  onOrganizationUpdated: (organization: Organization) => void
}

export function LandmarkMentionDetailDialogs({
  landmarkId,
  mentionDetails,
  onBuildingUpdated,
  onCharacterUpdated,
  onLandmarkUpdated,
  onOpenMention,
  onOrganizationUpdated,
}: LandmarkMentionDetailDialogsProps) {
  const {
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
  } = mentionDetails

  return (
    <>
      <LandmarkDetailDialog
        landmarkId={selectedLandmarkDetail?.id}
        open={Boolean(selectedLandmarkDetail)}
        onOpenChange={(open) => {
          if (!open) setSelectedLandmarkDetail(null)
        }}
        onLandmarkUpdated={(updatedLandmark) => {
          updateLandmarkReference(updatedLandmark)
          onLandmarkUpdated(updatedLandmark)
        }}
      />
      <EstadoDetailDialog
        estadoId={selectedEstadoDetailId}
        open={selectedEstadoDetailId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedEstadoDetailId(null)
        }}
        onEstadoUpdated={(updatedEstado: Estado) => {
          setSelectedEstadoDetailId(updatedEstado.id)
        }}
        onOpenEstado={(nextEstadoId) => {
          setSelectedEstadoDetailId(nextEstadoId)
        }}
        onOpenCharacter={(characterId) => {
          onOpenMention({ type: "character", id: characterId, label: "" })
        }}
        onOpenLandmark={(landmarkIdToOpen) => {
          onOpenMention({ type: "landmark", id: landmarkIdToOpen, label: "" })
        }}
      />
      <BuildingDetailDialog
        buildingId={selectedBuildingDetailId}
        open={isBuildingDialogOpen}
        onOpenChange={(open) => {
          setIsBuildingDialogOpen(open)
          if (!open) setSelectedBuildingDetailId(null)
        }}
        initialLandmarkId={landmarkId}
        onBuildingUpdated={(updatedBuilding) => {
          updateBuildingReference(updatedBuilding)
          onBuildingUpdated(updatedBuilding)
        }}
      />
      <CharacterDetailDialog
        characterId={selectedCharacterDetail?.character.id}
        open={isCharacterDialogOpen}
        onOpenChange={(open) => {
          setIsCharacterDialogOpen(open)
          if (!open) setSelectedCharacterDetail(null)
        }}
        initialLandmarkId={landmarkId}
        onCharacterUpdated={(updatedCharacter) => {
          updateCharacterReference(updatedCharacter)
          onCharacterUpdated(updatedCharacter)
        }}
      />
      <OrganizationDetailDialog
        organizationId={selectedOrganizationDetail?.id}
        open={isOrganizationDialogOpen}
        onOpenChange={(open) => {
          setIsOrganizationDialogOpen(open)
          if (!open) setSelectedOrganizationDetail(null)
        }}
        initialLandmarkId={landmarkId}
        onOrganizationUpdated={(updatedOrganization) => {
          updateOrganizationReference(updatedOrganization)
          onOrganizationUpdated(updatedOrganization)
        }}
      />
    </>
  )
}
