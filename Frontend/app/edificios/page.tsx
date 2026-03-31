"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { BuildingDetailDialog } from "@/components/dialog/detailed/BuildingDetailDialog"
import { MentionField } from "@/components/mentionField/MentionField"
import { SearchInput } from "@/components/search/SearchInput"
import { landmarkNameToSlug } from "@/lib/landmarks/slug"
import { matchesSearchQuery } from "@/lib/search/utils"
import { fetchBuildings } from "@/lib/services/building-api.service"
import { fetchLandmarkReferences } from "@/lib/services/landmark-api.service"
import { fetchOrganizations } from "@/lib/services/organization-api.service"
import type { Building } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRight, MapPin, User, Shield, Building2, Plus } from "lucide-react"

export default function EdificiosPage() {
  const [buildingsData, setBuildingsData] = useState<Building[]>([])
  const [landmarkNamesById, setLandmarkNamesById] = useState<Record<number, string>>({})
  const [organizationNamesById, setOrganizationNamesById] = useState<Record<number, string>>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const loadPageData = useCallback(async () => {
    const storedBuildings = await fetchBuildings().catch(() => [])
    const storedLandmarks = await fetchLandmarkReferences().catch(() => [])
    const storedOrganizations = await fetchOrganizations().catch(() => [])

    setBuildingsData(storedBuildings)
    setLandmarkNamesById(Object.fromEntries(storedLandmarks.map((landmark) => [landmark.id, landmark.nombre])))
    setOrganizationNamesById(
      Object.fromEntries(storedOrganizations.map((organization) => [organization.id, organization.nombre])),
    )
  }, [])

  useEffect(() => {
    void loadPageData()
  }, [loadPageData])

  const resolveLandmarkName = (landmarkId: number | null) =>
    typeof landmarkId === "number" && landmarkId > 0
      ? (landmarkNamesById[landmarkId] ?? "Desconocido")
      : "Sin ubicacion"
  const resolveOrganizationName = (organizationId: number) =>
    organizationNamesById[organizationId] ?? "Desconocido"
  const filteredBuildings = useMemo(
    () =>
      buildingsData.filter((building) =>
        matchesSearchQuery(
          searchQuery,
          building.nombre,
          building.descripcion,
          building.tags,
          building.duenoNombre,
          resolveLandmarkName(building.landmarkId),
          building.organizationId ? resolveOrganizationName(building.organizationId) : "",
        ),
      ),
    [buildingsData, landmarkNamesById, organizationNamesById, searchQuery],
  )

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex size-10 items-center justify-center rounded-sm border-2 border-primary/30 bg-primary/10">
              <Building2 className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-serif text-primary">Edificios</h1>
              <p className="text-sm text-muted-foreground">
                {filteredBuildings.length} de {buildingsData.length} estructuras registradas en el codex
              </p>
            </div>
          </div>
          <Button
            onClick={() => {
              setSelectedBuildingId(null)
              setDialogOpen(true)
            }}
            className="gap-2"
          >
            <Plus className="size-4" />
            Crear Edificio
          </Button>
        </div>
        <div className="ornament-divider mt-4">~</div>
      </div>

      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Buscar por nombre, descripcion, ubicacion, tags o dueno..."
        className="mb-4"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredBuildings.map((building) => (
          <div
            key={building.id}
            className="parchment group flex gap-4 rounded-sm p-4 transition-all hover:border-primary/50 hover:shadow-md cursor-pointer"
            onClick={() => {
              setSelectedBuildingId(building.id)
              setDialogOpen(true)
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                setSelectedBuildingId(building.id)
                setDialogOpen(true)
              }
            }}
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-sm border-2 border-primary/20 bg-primary/8 text-primary">
              <Building2 className="size-5" />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-serif text-base text-foreground group-hover:text-primary transition-colors leading-tight">
                  {building.nombre}
                </h3>
                <Button variant="ghost" size="icon" className="size-7 shrink-0 text-muted-foreground group-hover:text-primary" asChild>
                  <Link
                    href={`/edificios/${landmarkNameToSlug(building.nombre)}`}
                    onClick={(e) => {
                      e.stopPropagation()
                    }}
                  >
                    <ArrowRight className="size-4" />
                    <span className="sr-only">Ir a {building.nombre}</span>
                  </Link>
                </Button>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3 text-primary/50" />
                  {resolveLandmarkName(building.landmarkId)}
                </span>
                {building.duenoNombre && (
                  <span className="flex items-center gap-1">
                    <User className="size-3 text-primary/50" />
                    {building.duenoNombre}
                  </span>
                )}
              </div>

              {building.organizationId && (
                <span className="inline-flex w-fit items-center gap-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                  <Shield className="size-2.5" />
                  {resolveOrganizationName(building.organizationId)}
                </span>
              )}

              <MentionField
                source="auto"
                value={building.descripcion}
                editable={false}
                className="line-clamp-2 text-xs leading-relaxed text-muted-foreground"
                emptyText=""
              />

              <div className="mt-auto flex flex-wrap gap-1 pt-1">
                {building.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      {filteredBuildings.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted-foreground">No hay edificios que coincidan.</p>
      )}

      <BuildingDetailDialog
        buildingId={selectedBuildingId}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setSelectedBuildingId(null)
        }}
        resolveLandmarkName={resolveLandmarkName}
        resolveOrganizationName={resolveOrganizationName}
        onBuildingUpdated={(updatedBuilding) => {
          setSelectedBuildingId(updatedBuilding.id)
          void loadPageData()
        }}
        onBuildingDeleted={(deletedBuildingId) => {
          if (selectedBuildingId === deletedBuildingId) {
            setSelectedBuildingId(null)
          }
          setDialogOpen(false)
          void loadPageData()
        }}
      />
    </div>
  )
}
