"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { LandmarkDetailDialog } from "@/components/dialog/detailed/LandmarkDetailDialog"
import { MentionField } from "@/components/mentionField/MentionField"
import { SearchInput } from "@/components/search/SearchInput"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { landmarkNameToSlug } from "@/lib/landmarks/slug"
import { matchesSearchQuery } from "@/lib/search/utils"
import { fetchBuildings } from "@/lib/services/building-api.service"
import { fetchCharacters } from "@/lib/services/character-api.service"
import { fetchLandmarks } from "@/lib/services/landmark-api.service"
import { fetchOrganizations } from "@/lib/services/organization-api.service"
import type { Landmark } from "@/lib/types"
import { ArrowRight, Building2, CalendarDays, MapPin, Shield, Users } from "lucide-react"

function isImageIcon(icono: string) {
  return icono.startsWith("http://") || icono.startsWith("https://") || icono.startsWith("data:") || icono.startsWith("/")
}

function LandmarkIcon({ landmark, className }: { landmark: Landmark; className: string }) {
  if (isImageIcon(landmark.icono)) {
    return <img src={landmark.icono} alt={landmark.nombre} className={`${className} object-contain`} />
  }

  return <MapPin className={className} />
}

const tipoLabels: Record<string, string> = {
  ciudad: "Ciudad",
  pueblo: "Pueblo",
  aldea: "Aldea",
  fuerte: "Fuerte",
  puente: "Puente",
  bandera: "Bandera",
  campamento: "Campamento",
  mazmorra: "Mazmorra",
}

type LandmarksPageContentProps = {
  showHeader?: boolean
  loadRelatedData?: boolean
}

export function LandmarksPageContent({ showHeader = true, loadRelatedData = true }: LandmarksPageContentProps) {
  const router = useRouter()
  const [landmarksData, setLandmarksData] = useState<Landmark[]>([])
  const [countsByLandmarkId, setCountsByLandmarkId] = useState<Record<number, { buildings: number; characters: number; organizations: number }>>({})
  const [searchTermsByLandmarkId, setSearchTermsByLandmarkId] = useState<Record<number, string[]>>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedLandmarkId, setSelectedLandmarkId] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const loadPageData = useCallback(async () => {
    const storedLandmarks = await fetchLandmarks().catch(() => [])
    const storedBuildings = loadRelatedData ? await fetchBuildings().catch(() => []) : []
    const storedCharacters = loadRelatedData ? await fetchCharacters().catch(() => []) : []
    const storedOrganizations = loadRelatedData ? await fetchOrganizations().catch(() => []) : []

    const buildingIdsByLandmark = new Map<number, Set<number>>()
    const characterIdsByLandmark = new Map<number, Set<number>>()
    const organizationIdsByLandmark = new Map<number, Set<number>>()
    const buildingNamesByLandmark = new Map<number, Set<string>>()
    const characterNamesByLandmark = new Map<number, Set<string>>()
    const organizationNamesByLandmark = new Map<number, Set<string>>()

    for (const building of storedBuildings) {
      if (typeof building.landmarkId !== "number" || building.landmarkId <= 0) continue
      const target = buildingIdsByLandmark.get(building.landmarkId) ?? new Set<number>()
      target.add(building.id)
      buildingIdsByLandmark.set(building.landmarkId, target)

      const names = buildingNamesByLandmark.get(building.landmarkId) ?? new Set<string>()
      names.add(building.nombre)
      buildingNamesByLandmark.set(building.landmarkId, names)
    }

    for (const character of storedCharacters) {
      const target = characterIdsByLandmark.get(character.landmarkId) ?? new Set<number>()
      target.add(character.id)
      characterIdsByLandmark.set(character.landmarkId, target)

      const names = characterNamesByLandmark.get(character.landmarkId) ?? new Set<string>()
      names.add(character.nombre)
      characterNamesByLandmark.set(character.landmarkId, names)
    }

    for (const organization of storedOrganizations) {
      for (const landmarkId of organization.landmarks) {
        const target = organizationIdsByLandmark.get(landmarkId) ?? new Set<number>()
        target.add(organization.id)
        organizationIdsByLandmark.set(landmarkId, target)

        const names = organizationNamesByLandmark.get(landmarkId) ?? new Set<string>()
        names.add(organization.nombre)
        organizationNamesByLandmark.set(landmarkId, names)
      }
    }

    for (const landmark of storedLandmarks) {
      const buildingIds = buildingIdsByLandmark.get(landmark.id) ?? new Set<number>()
      for (const building of landmark.edificios) buildingIds.add(building.id)
      buildingIdsByLandmark.set(landmark.id, buildingIds)
      const buildingNames = buildingNamesByLandmark.get(landmark.id) ?? new Set<string>()
      for (const building of landmark.edificios) buildingNames.add(building.nombre)
      buildingNamesByLandmark.set(landmark.id, buildingNames)

      const characterIds = characterIdsByLandmark.get(landmark.id) ?? new Set<number>()
      for (const character of landmark.personajes) characterIds.add(character.id)
      characterIdsByLandmark.set(landmark.id, characterIds)
      const characterNames = characterNamesByLandmark.get(landmark.id) ?? new Set<string>()
      for (const character of landmark.personajes) characterNames.add(character.nombre)
      characterNamesByLandmark.set(landmark.id, characterNames)
    }

    const nextCountsByLandmarkId: Record<number, { buildings: number; characters: number; organizations: number }> = {}
    const nextSearchTermsByLandmarkId: Record<number, string[]> = {}
    for (const landmark of storedLandmarks) {
      nextCountsByLandmarkId[landmark.id] = {
        buildings: buildingIdsByLandmark.get(landmark.id)?.size ?? 0,
        characters: characterIdsByLandmark.get(landmark.id)?.size ?? 0,
        organizations: organizationIdsByLandmark.get(landmark.id)?.size ?? 0,
      }
      nextSearchTermsByLandmarkId[landmark.id] = [
        ...(buildingNamesByLandmark.get(landmark.id) ?? []),
        ...(characterNamesByLandmark.get(landmark.id) ?? []),
        ...(organizationNamesByLandmark.get(landmark.id) ?? []),
      ]
    }

    setLandmarksData(storedLandmarks)
    setCountsByLandmarkId(nextCountsByLandmarkId)
    setSearchTermsByLandmarkId(nextSearchTermsByLandmarkId)
  }, [loadRelatedData])

  useEffect(() => {
    void loadPageData()
  }, [loadPageData])

  const filteredLandmarks = useMemo(
    () =>
      landmarksData.filter((landmark) =>
        matchesSearchQuery(
          searchQuery,
          landmark.nombre,
          landmark.tipo,
          tipoLabels[landmark.tipo] ?? landmark.tipo,
          landmark.descripcionCorta,
          landmark.historia,
          landmark.tags,
          landmark.poblacion,
          landmark.eventos.flatMap((event) => [event.nombre, event.descripcion, event.fecha]),
          searchTermsByLandmarkId[landmark.id] ?? [],
        ),
      ),
    [landmarksData, searchQuery, searchTermsByLandmarkId],
  )

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-8">
      {showHeader ? (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex size-10 items-center justify-center rounded-sm border-2 border-primary/30 bg-primary/10">
              <MapPin className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-serif text-primary">Landmarks</h1>
              <p className="text-sm text-muted-foreground">{filteredLandmarks.length} de {landmarksData.length} regiones registradas en el codex</p>
            </div>
          </div>
          <div className="ornament-divider mt-4">~</div>
        </div>
      ) : null}

      <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Buscar por nombre, tipo, descripcion, tags o contenido relacionado..." className="mb-4" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredLandmarks.map((landmark) => {
          const counts = countsByLandmarkId[landmark.id] ?? { buildings: landmark.edificios.length, characters: landmark.personajes.length, organizations: 0 }

          return (
            <div
              key={landmark.id}
              className="parchment group flex rounded-sm transition-all hover:border-primary/50 hover:shadow-md cursor-pointer overflow-hidden"
              onClick={() => {
                setSelectedLandmarkId(landmark.id)
                setDialogOpen(true)
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setSelectedLandmarkId(landmark.id)
                  setDialogOpen(true)
                }
              }}
            >
              <div className="flex w-20 shrink-0 flex-col items-center justify-center border-r border-border bg-secondary/40 p-4">
                <LandmarkIcon landmark={landmark} className="size-8 text-primary" />
                <span className="mt-2 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground text-center">{tipoLabels[landmark.tipo] ?? landmark.tipo}</span>
              </div>

              <div className="flex flex-1 flex-col gap-2 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-serif text-xl text-foreground group-hover:text-primary transition-colors leading-tight">{landmark.nombre}</h3>
                    {landmark.poblacion ? <span className="text-xs text-muted-foreground">{landmark.poblacion.toLocaleString()} habitantes</span> : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground group-hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/landmarks/${landmarkNameToSlug(landmark.nombre)}`)
                    }}
                  >
                    <ArrowRight className="size-4" />
                    <span className="sr-only">Ir a {landmark.nombre}</span>
                  </Button>
                </div>

                {landmark.descripcionCorta ? <MentionField source="auto" value={landmark.descripcionCorta} editable={false} className="line-clamp-2 text-xs leading-relaxed text-muted-foreground" /> : null}

                <div className="flex flex-wrap gap-1">
                  {landmark.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">{tag}</Badge>
                  ))}
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-auto pt-2 border-t border-border">
                  <span className="flex items-center gap-1"><CalendarDays className="size-3 text-primary/50" />{landmark.eventos.length} eventos</span>
                  <span className="flex items-center gap-1"><Building2 className="size-3 text-primary/50" />{counts.buildings} edificios</span>
                  <span className="flex items-center gap-1"><Users className="size-3 text-primary/50" />{counts.characters} personajes</span>
                  <span className="flex items-center gap-1"><Shield className="size-3 text-primary/50" />{counts.organizations} organizaciones</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {filteredLandmarks.length === 0 ? <p className="mt-6 text-center text-sm text-muted-foreground">No hay landmarks que coincidan.</p> : null}

      <LandmarkDetailDialog
        landmarkId={selectedLandmarkId}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setSelectedLandmarkId(null)
        }}
        onLandmarkUpdated={(updatedLandmark) => {
          setSelectedLandmarkId(updatedLandmark.id)
          void loadPageData()
        }}
        onLandmarkDeleted={(deletedLandmarkId) => {
          if (selectedLandmarkId === deletedLandmarkId) {
            setSelectedLandmarkId(null)
          }
          setDialogOpen(false)
          void loadPageData()
        }}
      />
    </div>
  )
}
