"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CharacterCard } from "@/components/characters/CharacterCard"
import { CharactersPageHeader } from "@/components/characters/CharactersPageHeader"
import { CharacterDetailDialog } from "@/components/dialog/detailed/CharacterDetailDialog"
import { CharacterSheetDialog } from "@/components/dialog/detailed/CharacterSheetDialog"
import { SearchInput } from "@/components/search/SearchInput"
import { matchesSearchQuery } from "@/lib/search/utils"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import { fetchCharacterReferences, fetchCharacters, updateCharacter } from "@/lib/services/character-api.service"
import type { Character } from "@/lib/types"
import { Plus, Swords } from "lucide-react"

type CharactersPageContentProps = {
  initialScope?: "players" | "npcs"
}

const CHARACTER_SCOPE_LABELS = {
  players: {
    tabLabel: "Jugadores",
    emptyLabel: "jugadores registrados en el codex",
    loadingLabel: "Cargando jugadores...",
    noMatchesLabel: "No hay jugadores que coincidan.",
    creationLabel: "Crear Jugador",
  },
  npcs: {
    tabLabel: "Personajes",
    emptyLabel: "personajes registrados en el codex",
    loadingLabel: "Cargando personajes...",
    noMatchesLabel: "No hay personajes que coincidan.",
    creationLabel: "Crear Personaje",
  },
} as const

export function CharactersPageContent({ initialScope = "npcs" }: CharactersPageContentProps) {
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
  const [scope, setScope] = useState<"players" | "npcs">(initialScope)

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

  const scopeLabels = CHARACTER_SCOPE_LABELS[scope]

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
      <CharactersPageHeader
        title="Personajes"
        subtitle={`${filteredCharacters.length} de ${scopedCharacters.length} ${scopeLabels.emptyLabel}`}
        scope={scope}
        onScopeChange={setScope}
        onCreate={() => {
          setSelectedCharacter(null)
          setDialogOpen(true)
        }}
        createLabel={scopeLabels.creationLabel}
        icon={Swords}
        createIcon={Plus}
      />

      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Buscar por nombre, raza, clase, descripcion, tags o ubicacion..."
        className="mb-4"
      />
      {loadError && <p className="mb-4 text-sm text-destructive">{loadError}</p>}
      {isLoading && <p className="mb-4 text-sm text-muted-foreground">{scopeLabels.loadingLabel}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredCharacters.map((character) => (
          <CharacterCard
            key={character.id}
            character={character}
            landmarkName={getLandmarkName(character.landmarkId)}
            organizationNames={character.organizationIds.map((organizationId) => getOrganizationName(organizationId))}
            onOpenDetail={handleOpenCharacterDialog}
            onOpenSheet={handleOpenCharacterSheet}
          />
        ))}
      </div>

      {filteredCharacters.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted-foreground">{scopeLabels.noMatchesLabel}</p>
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
