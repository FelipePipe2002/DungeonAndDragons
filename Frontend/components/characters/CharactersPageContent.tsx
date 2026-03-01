"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CharacterSheetDialog } from "@/components/dialog/detailed/CharacterSheetDialog"
import { CharacterDetailDialog } from "@/components/dialog/detailed/CharacterDetailDialog"
import { SearchInput } from "@/components/search/SearchInput"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { matchesSearchQuery } from "@/lib/search/utils"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import { fetchCharacterReferences, fetchCharacters, updateCharacter } from "@/lib/services/character-api.service"
import type { Character } from "@/lib/types"
import { ArrowRight, BookOpen, ImageOff, MapPin, Plus, Shield, Swords } from "lucide-react"

function CharacterImage({
  imagen,
  nombre,
  size = "md",
}: {
  imagen?: string
  nombre: string
  size?: "sm" | "md" | "lg"
}) {
  const sizeClasses = {
    sm: "h-16 w-12",
    md: "h-52 w-32",
    lg: "h-64 w-40",
  }

  if (imagen) {
    return (
      <div className={`${sizeClasses[size]} overflow-hidden rounded-sm border border-border`}>
        <img src={imagen} alt={nombre} className="size-full object-cover" />
      </div>
    )
  }

  return (
    <div
      className={`${sizeClasses[size]} flex flex-col items-center justify-center rounded-sm border border-border bg-secondary text-muted-foreground`}
    >
      <ImageOff className="mb-1 size-6 opacity-30" />
      <span className="text-xs uppercase tracking-wider opacity-50">Sin imagen</span>
    </div>
  )
}

type CharactersPageContentProps = {
  title: string
  emptyLabel: string
  loadingLabel: string
  noMatchesLabel: string
  creationLabel: string
  scope: "players" | "npcs"
}

export function CharactersPageContent({
  title,
  emptyLabel,
  loadingLabel,
  noMatchesLabel,
  creationLabel,
  scope,
}: CharactersPageContentProps) {
  const [charactersData, setCharactersData] = useState<Character[]>([])
  const [landmarkNamesById, setLandmarkNamesById] = useState<Record<number, string>>({})
  const [buildingNamesById, setBuildingNamesById] = useState<Record<number, string>>({})
  const [organizationNamesById, setOrganizationNamesById] = useState<Record<number, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSheetCharacter, setSelectedSheetCharacter] = useState<Character | null>(null)
  const [characterSheetDialogOpen, setCharacterSheetDialogOpen] = useState(false)

  const loadPageData = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const [characters, references] = await Promise.all([fetchCharacters(), fetchCharacterReferences()])

      setCharactersData(characters)
      setLandmarkNamesById(
        Object.fromEntries(references.landmarks.map((landmark) => [landmark.id, landmark.nombre])),
      )
      setBuildingNamesById(
        Object.fromEntries(references.buildings.map((building) => [building.id, building.nombre])),
      )
      setOrganizationNamesById(
        Object.fromEntries(
          references.organizations.map((organization) => [organization.id, organization.nombre]),
        ),
      )
    } catch (error) {
      setLoadError(getBackendErrorMessage(error, "No se pudieron cargar los personajes."))
      setCharactersData([])
      setLandmarkNamesById({})
      setBuildingNamesById({})
      setOrganizationNamesById({})
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPageData()
  }, [loadPageData])

  const getLandmarkName = (landmarkId: number) =>
    landmarkId > 0 ? (landmarkNamesById[landmarkId] ?? "Desconocido") : "Sin ubicacion"
  const getBuildingName = (buildingId: number) => buildingNamesById[buildingId] ?? "Desconocido"
  const getOrganizationName = (organizationId: number) =>
    organizationNamesById[organizationId] ?? "Desconocido"

  const scopedCharacters = useMemo(
    () => charactersData.filter((character) => (scope === "players" ? character.isPlayer : !character.isPlayer)),
    [charactersData, scope],
  )

  const filteredCharacters = useMemo(
    () =>
      scopedCharacters.filter((character) =>
        matchesSearchQuery(
          searchQuery,
          character.nombre,
          character.raza,
          character.clase,
          character.descripcion,
          character.tags,
          getLandmarkName(character.landmarkId),
          character.buildingIds.map((buildingId) => getBuildingName(buildingId)),
          character.organizationIds.map((organizationId) => getOrganizationName(organizationId)),
        ),
      ),
    [buildingNamesById, landmarkNamesById, organizationNamesById, scopedCharacters, searchQuery],
  )

  const handleOpenCharacterDialog = (character: Character) => {
    setSelectedCharacter(character)
    setDialogOpen(true)
  }

  const handleOpenCharacterSheet = (character: Character) => {
    setSelectedSheetCharacter(character)
    setCharacterSheetDialogOpen(true)
  }

  const handleSaveCharacterSheet = async (nextSheet: Character["characterSheet"]) => {
    if (!selectedSheetCharacter) {
      return false
    }

    const { id: characterId, ...characterInput } = {
      ...selectedSheetCharacter,
      characterSheet: nextSheet,
    }

    try {
      const updatedCharacter = await updateCharacter(characterId, characterInput)
      setSelectedSheetCharacter(updatedCharacter)
      setCharactersData((prev) =>
        prev.map((character) => (character.id === updatedCharacter.id ? updatedCharacter : character)),
      )
      setSelectedCharacter((prev) => (prev?.id === updatedCharacter.id ? updatedCharacter : prev))
      setLoadError(null)
      return true
    } catch (error) {
      setLoadError(getBackendErrorMessage(error, "No se pudo guardar la hoja de personaje."))
      return false
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-sm border-2 border-primary/30 bg-primary/10">
              <Swords className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-serif text-primary">{title}</h1>
              <p className="text-sm text-muted-foreground">
                {filteredCharacters.length} de {scopedCharacters.length} {emptyLabel}
              </p>
            </div>
          </div>
          <Button
            onClick={() => {
              setSelectedCharacter(null)
              setDialogOpen(true)
            }}
            className="gap-2"
          >
            <Plus className="size-4" />
            {creationLabel}
          </Button>
        </div>
        <div className="ornament-divider mt-4">~</div>
      </div>

      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Buscar por nombre, raza, clase, descripcion, tags o ubicacion..."
        className="mb-4"
      />
      {loadError && <p className="mb-4 text-sm text-destructive">{loadError}</p>}
      {isLoading && <p className="mb-4 text-sm text-muted-foreground">{loadingLabel}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredCharacters.map((character) => {
          const traitLine = [character.clase, character.raza]
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
            .join(" / ")

          return (
            <div
              key={character.id}
              className="parchment group flex cursor-pointer flex-row gap-4 rounded-sm transition-all hover:border-primary/50 hover:shadow-md"
              onClick={() => handleOpenCharacterDialog(character)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleOpenCharacterDialog(character)
                }
              }}
            >
              <div className="shrink-0">
                <CharacterImage imagen={character.imagen} nombre={character.nombre} size="md" />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2 py-4 pr-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="leading-tight text-lg font-serif text-foreground transition-colors group-hover:text-primary">
                        {character.nombre}
                      </h3>
                      {character.isPlayer ? (
                        <Badge variant="outline" className="border-primary/30 px-1.5 py-0 text-[10px] text-primary">
                          Jugador
                        </Badge>
                      ) : null}
                    </div>
                    {traitLine && <div className="mt-0.5 text-xs text-muted-foreground">{traitLine}</div>}
                  </div>
                  <div className="flex items-center gap-1">
                    {character.characterSheet ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 px-2 text-[11px]"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenCharacterSheet(character)
                        }}
                      >
                        <BookOpen className="size-3" />
                        Hoja
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground group-hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenCharacterDialog(character)
                      }}
                    >
                      <ArrowRight className="size-4" />
                      <span className="sr-only">Ir a {character.nombre}</span>
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="size-3 text-primary/50" />
                  {getLandmarkName(character.landmarkId)}
                </div>

                {character.organizationIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {character.organizationIds.map((organizationId) => (
                      <span
                        key={organizationId}
                        className="inline-flex items-center gap-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
                      >
                        <Shield className="size-2.5" />
                        {getOrganizationName(organizationId)}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-auto flex flex-wrap gap-1 pt-2">
                  {character.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                      {tag}
                    </Badge>
                  ))}
                </div>

                {character.eventos.length > 0 && (
                  <div className="mt-1 flex items-center gap-1 border-t border-border pt-2 text-[10px] text-muted-foreground">
                    <BookOpen className="size-3" />
                    {character.eventos.length} nota{character.eventos.length !== 1 ? "s" : ""} de sesion
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {filteredCharacters.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted-foreground">{noMatchesLabel}</p>
      )}

      <CharacterDetailDialog
        characterId={selectedCharacter?.id}
        open={dialogOpen}
        initialIsPlayer={scope === "players"}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setSelectedCharacter(null)
          }
        }}
        onCharacterUpdated={(updatedCharacter) => {
          setSelectedCharacter(updatedCharacter)
          void loadPageData()
        }}
        onCharacterDeleted={(deletedCharacterId) => {
          if (selectedCharacter?.id === deletedCharacterId) {
            setSelectedCharacter(null)
          }
          setDialogOpen(false)
          void loadPageData()
        }}
      />

      <CharacterSheetDialog
        open={characterSheetDialogOpen}
        onOpenChange={(open) => {
          setCharacterSheetDialogOpen(open)
          if (!open) {
            setSelectedSheetCharacter(null)
          }
        }}
        value={selectedSheetCharacter?.characterSheet ?? null}
        onSave={handleSaveCharacterSheet}
        characterName={selectedSheetCharacter?.nombre ?? ""}
        characterRace={selectedSheetCharacter?.raza ?? ""}
        characterClass={selectedSheetCharacter?.clase ?? ""}
      />
    </div>
  )
}
