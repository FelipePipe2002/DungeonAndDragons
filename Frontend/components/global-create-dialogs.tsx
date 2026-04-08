"use client"

import { useEffect, useState } from "react"

import { CreateDmEventDialog } from "@/components/dialog/detailed/CreateDmEventDialog"
import { CreateDmRelationshipDialog } from "@/components/dialog/detailed/CreateDmRelationshipDialog"
import { BuildingDetailDialog } from "@/components/dialog/detailed/BuildingDetailDialog"
import { CharacterDetailDialog } from "@/components/dialog/detailed/CharacterDetailDialog"
import { OrganizationDetailDialog } from "@/components/dialog/detailed/OrganizationDetailDialog"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import { createDmRelationship } from "@/lib/services/dm-relationships-api.service"
import { createDmEvent } from "@/lib/services/dm-events-api.service"
import { serviceMessage } from "@/lib/service-message"
import {
  OPEN_CREATE_DM_EVENT,
  OPEN_CREATE_DM_RELATIONSHIP_EVENT,
  OPEN_CREATE_BUILDING_EVENT,
  OPEN_CREATE_CHARACTER_EVENT,
  OPEN_CREATE_ORGANIZATION_EVENT,
  notifyDmEventsChanged,
  notifyDmRelationshipsChanged,
  notifyBuildingsChanged,
  notifyCharactersChanged,
  notifyOrganizationsChanged,
} from "@/lib/navigation/global-create-events"

export function GlobalCreateDialogs() {
  const [isCharacterDialogOpen, setIsCharacterDialogOpen] = useState(false)
  const [isBuildingDialogOpen, setIsBuildingDialogOpen] = useState(false)
  const [isOrganizationDialogOpen, setIsOrganizationDialogOpen] = useState(false)
  const [isDmEventDialogOpen, setIsDmEventDialogOpen] = useState(false)
  const [isDmRelationshipDialogOpen, setIsDmRelationshipDialogOpen] = useState(false)

  useEffect(() => {
    const openCharacterDialog = () => {
      setIsCharacterDialogOpen(true)
    }
    const openBuildingDialog = () => {
      setIsBuildingDialogOpen(true)
    }
    const openOrganizationDialog = () => {
      setIsOrganizationDialogOpen(true)
    }
    const openDmEventDialog = () => {
      setIsDmEventDialogOpen(true)
    }
    const openDmRelationshipDialog = () => {
      setIsDmRelationshipDialogOpen(true)
    }

    window.addEventListener(OPEN_CREATE_CHARACTER_EVENT, openCharacterDialog)
    window.addEventListener(OPEN_CREATE_BUILDING_EVENT, openBuildingDialog)
    window.addEventListener(OPEN_CREATE_ORGANIZATION_EVENT, openOrganizationDialog)
    window.addEventListener(OPEN_CREATE_DM_EVENT, openDmEventDialog)
    window.addEventListener(OPEN_CREATE_DM_RELATIONSHIP_EVENT, openDmRelationshipDialog)

    return () => {
      window.removeEventListener(OPEN_CREATE_CHARACTER_EVENT, openCharacterDialog)
      window.removeEventListener(OPEN_CREATE_BUILDING_EVENT, openBuildingDialog)
      window.removeEventListener(OPEN_CREATE_ORGANIZATION_EVENT, openOrganizationDialog)
      window.removeEventListener(OPEN_CREATE_DM_EVENT, openDmEventDialog)
      window.removeEventListener(OPEN_CREATE_DM_RELATIONSHIP_EVENT, openDmRelationshipDialog)
    }
  }, [])

  return (
    <>
      <CharacterDetailDialog
        open={isCharacterDialogOpen}
        onOpenChange={setIsCharacterDialogOpen}
        initialIsPlayer={false}
        onCharacterUpdated={notifyCharactersChanged}
      />

      <BuildingDetailDialog
        open={isBuildingDialogOpen}
        onOpenChange={setIsBuildingDialogOpen}
        onBuildingUpdated={() => {
          notifyBuildingsChanged()
          notifyCharactersChanged()
        }}
      />

      <OrganizationDetailDialog
        open={isOrganizationDialogOpen}
        onOpenChange={setIsOrganizationDialogOpen}
        onOrganizationUpdated={() => {
          notifyOrganizationsChanged()
          notifyCharactersChanged()
          notifyBuildingsChanged()
        }}
      />

      <CreateDmEventDialog
        open={isDmEventDialogOpen}
        onOpenChange={setIsDmEventDialogOpen}
        onSaveEvent={async (event) => {
          try {
            await createDmEvent(event)
            notifyDmEventsChanged()
            serviceMessage.success({
              title: "Evento agregado",
              description: "El evento del DM se guardo correctamente.",
            })
            return true
          } catch (error) {
            serviceMessage.error({
              title: "No se pudo guardar el evento",
              description: getBackendErrorMessage(error, "No se pudo guardar el evento del DM."),
            })
            return false
          }
        }}
      />

      <CreateDmRelationshipDialog
        open={isDmRelationshipDialogOpen}
        onOpenChange={setIsDmRelationshipDialogOpen}
        onCreateRelationship={async (relationship) => {
          try {
            await createDmRelationship(relationship)
            notifyDmRelationshipsChanged()
            serviceMessage.success({
              title: "Relacion agregada",
              description: "La relacion del DM se guardo correctamente.",
            })
            return true
          } catch (error) {
            serviceMessage.error({
              title: "No se pudo guardar la relacion",
              description: getBackendErrorMessage(error, "No se pudo guardar la relacion del DM."),
            })
            return false
          }
        }}
      />
    </>
  )
}
