"use client"

import { useEffect, useState } from "react"

import { BuildingDetailDialog } from "@/components/dialog/detailed/BuildingDetailDialog"
import { CharacterDetailDialog } from "@/components/dialog/detailed/CharacterDetailDialog"
import { OrganizationDetailDialog } from "@/components/dialog/detailed/OrganizationDetailDialog"
import {
  OPEN_CREATE_BUILDING_EVENT,
  OPEN_CREATE_CHARACTER_EVENT,
  OPEN_CREATE_ORGANIZATION_EVENT,
  notifyBuildingsChanged,
  notifyCharactersChanged,
  notifyOrganizationsChanged,
} from "@/lib/navigation/global-create-events"

export function GlobalCreateDialogs() {
  const [isCharacterDialogOpen, setIsCharacterDialogOpen] = useState(false)
  const [isBuildingDialogOpen, setIsBuildingDialogOpen] = useState(false)
  const [isOrganizationDialogOpen, setIsOrganizationDialogOpen] = useState(false)

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

    window.addEventListener(OPEN_CREATE_CHARACTER_EVENT, openCharacterDialog)
    window.addEventListener(OPEN_CREATE_BUILDING_EVENT, openBuildingDialog)
    window.addEventListener(OPEN_CREATE_ORGANIZATION_EVENT, openOrganizationDialog)

    return () => {
      window.removeEventListener(OPEN_CREATE_CHARACTER_EVENT, openCharacterDialog)
      window.removeEventListener(OPEN_CREATE_BUILDING_EVENT, openBuildingDialog)
      window.removeEventListener(OPEN_CREATE_ORGANIZATION_EVENT, openOrganizationDialog)
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
    </>
  )
}
