"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { OrganizationDetailDialog } from "@/components/dialog/detailed/OrganizationDetailDialog"
import { MentionField } from "@/components/mentionField/MentionField"
import { SearchInput } from "@/components/search/SearchInput"
import { ORGANIZATIONS_CHANGED_EVENT } from "@/lib/navigation/global-create-events"
import { matchesSearchQuery } from "@/lib/search/utils"
import { fetchBuildings } from "@/lib/services/building-api.service"
import { fetchCharacterReferences } from "@/lib/services/character-api.service"
import { fetchOrganizations } from "@/lib/services/organization-api.service"
import type { Organization } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRight, MapPin, Building2, Users, Shield, Plus } from "lucide-react"

function OrganizationAvatar({ organization }: { organization: Organization }) {
  if (organization.imagen) {
    return (
      <div className="size-10 shrink-0 overflow-hidden rounded-sm border-2 border-primary/20 bg-primary/8">
        <img src={organization.imagen} alt={organization.nombre} className="size-full object-cover" />
      </div>
    )
  }

  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-sm border-2 border-primary/20 bg-primary/8">
      <Shield className="size-5 text-primary" />
    </div>
  )
}

export default function OrganizacionesPage() {
  const [organizationsData, setOrganizationsData] = useState<Organization[]>([])
  const [landmarkNamesById, setLandmarkNamesById] = useState<Record<number, string>>({})
  const [buildingNamesById, setBuildingNamesById] = useState<Record<number, string>>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const loadPageData = useCallback(async () => {
    const storedOrganizations = await fetchOrganizations().catch(() => [])
    const references = await fetchCharacterReferences().catch(() => ({ landmarks: [], buildings: [], organizations: [] }))
    const storedBuildings = await fetchBuildings().catch(() => [])

    setOrganizationsData(storedOrganizations)
    setLandmarkNamesById(
      Object.fromEntries(references.landmarks.map((landmark) => [landmark.id, landmark.nombre])),
    )
    setBuildingNamesById(Object.fromEntries(storedBuildings.map((building) => [building.id, building.nombre])))
  }, [])

  useEffect(() => {
    void loadPageData()
  }, [loadPageData])

  useEffect(() => {
    const handleOrganizationsChanged = () => {
      void loadPageData()
    }

    window.addEventListener(ORGANIZATIONS_CHANGED_EVENT, handleOrganizationsChanged)
    return () => {
      window.removeEventListener(ORGANIZATIONS_CHANGED_EVENT, handleOrganizationsChanged)
    }
  }, [loadPageData])

  const resolveLandmarkName = (landmarkId: number) => landmarkNamesById[landmarkId] ?? "Desconocido"
  const resolveBuildingName = (buildingId: number) => buildingNamesById[buildingId] ?? "Desconocido"
  const filteredOrganizations = useMemo(
    () =>
      organizationsData.filter((organization) =>
        matchesSearchQuery(
          searchQuery,
          organization.nombre,
          organization.descripcion,
          organization.categorias,
          organization.tags,
          organization.landmarks.map((landmarkId) => resolveLandmarkName(landmarkId)),
          organization.edificios.map((buildingId) => resolveBuildingName(buildingId)),
          organization.miembros.flatMap((member) => [
            member.nombre,
            member.raza,
            member.profesion,
            member.categoria,
          ]),
        ),
      ),
    [buildingNamesById, landmarkNamesById, organizationsData, searchQuery],
  )

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex size-10 items-center justify-center rounded-sm border-2 border-primary/30 bg-primary/10">
              <Shield className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-serif text-primary">Organizaciones</h1>
              <p className="text-sm text-muted-foreground">
                {filteredOrganizations.length} de {organizationsData.length} facciones registradas en el codex
              </p>
            </div>
          </div>
          <Button
            onClick={() => {
              setSelectedOrg(null)
              setDialogOpen(true)
            }}
            className="gap-2"
          >
            <Plus className="size-4" />
            Crear Organizacion
          </Button>
        </div>
        <div className="ornament-divider mt-4">~</div>
      </div>

      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Buscar por nombre, descripcion, categorias, miembros, sedes o regiones..."
        className="mb-4"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredOrganizations.map((org) => (
          <div
            key={org.id}
            className="parchment group flex flex-col rounded-sm transition-all hover:border-primary/50 hover:shadow-md cursor-pointer overflow-hidden"
            onClick={() => {
              setSelectedOrg(org)
              setDialogOpen(true)
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                setSelectedOrg(org)
                setDialogOpen(true)
              }
            }}
          >
            <div className="flex flex-1 flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <OrganizationAvatar organization={org} />
                  <div>
                    <h3 className="font-serif text-lg text-foreground group-hover:text-primary transition-colors leading-tight">
                      {org.nombre}
                    </h3>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {org.categorias.map((cat) => (
                        <Badge key={cat} variant="outline" className="border-primary/20 text-[10px] text-primary font-normal">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground group-hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                >
                  <ArrowRight className="size-4" />
                  <span className="sr-only">Ir a {org.nombre}</span>
                </Button>
              </div>

              <MentionField
                source="auto"
                value={org.descripcion}
                editable={false}
                className="line-clamp-2 text-xs leading-relaxed text-muted-foreground"
                emptyText=""
              />

              {/* Known members preview */}
              {org.miembros.length > 0 && (
                <div className="rounded-sm border border-border bg-secondary/40 p-3">
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Miembros conocidos
                  </h4>
                  <div className="flex flex-col gap-1.5">
                    {org.miembros.slice(0, 3).map((m) => (
                      <div key={m.personajeId} className="flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <span className="font-medium text-foreground">{m.nombre}</span>
                          <span className="ml-2 text-muted-foreground">
                            {[m.raza, m.profesion].filter((value) => value.trim().length > 0).join(" / ")}
                          </span>
                        </div>
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-normal">
                          {m.categoria}
                        </Badge>
                      </div>
                    ))}
                    {org.miembros.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{org.miembros.length - 3} mas...
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-auto pt-2 border-t border-border">
                <span className="flex items-center gap-1">
                  <Users className="size-3 text-primary/50" />
                  {org.miembros.length} miembros
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="size-3 text-primary/50" />
                  {org.edificios.length} sedes
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="size-3 text-primary/50" />
                  {org.landmarks.length} regiones
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {filteredOrganizations.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted-foreground">No hay organizaciones que coincidan.</p>
      )}

      <OrganizationDetailDialog
        organizationId={selectedOrg?.id}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setSelectedOrg(null)
        }}
        resolveBuildingName={resolveBuildingName}
        resolveLandmarkName={resolveLandmarkName}
        onOrganizationUpdated={(updatedOrganization) => {
          setSelectedOrg(updatedOrganization)
          void loadPageData()
        }}
        onOrganizationDeleted={(deletedOrganizationId) => {
          if (selectedOrg?.id === deletedOrganizationId) {
            setSelectedOrg(null)
          }
          setDialogOpen(false)
          void loadPageData()
        }}
      />
    </div>
  )
}
