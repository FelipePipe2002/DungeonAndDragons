"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CharacterDetailDialog } from "@/components/dialog/detailed/CharacterDetailDialog"
import { CharacterSheetDialog } from "@/components/dialog/detailed/CharacterSheetDialog"
import { CharacterCard } from "@/components/entities/CharacterCard"
import { EntitiesPageHeader } from "@/components/entities/EntitiesPageHeader"
import { SearchInput } from "@/components/search/SearchInput"
import { Button } from "@/components/ui/button"
import { UNKNOWN_LABEL } from "@/lib/display"
import { CHARACTERS_CHANGED_EVENT } from "@/lib/navigation/events"
import { matchesSearchQuery } from "@/lib/search/utils"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import { fetchCharacterReferences, fetchCharacters, updateCharacter } from "@/lib/services/character-api.service"
import type { Character } from "@/lib/types"
import { Plus, Swords } from "lucide-react"

type CharactersPageContentProps = {
  initialScope?: "players" | "npcs"
  showHeader?: boolean
  loadRelatedData?: boolean
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

const CHARACTER_SCOPE_TAB_LABELS = {
  players: "Jugadores",
  npcs: "Personajes",
} as const

export function CharactersPageContent({ initialScope = "npcs", showHeader = true, loadRelatedData = true }: CharactersPageContentProps) {
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

  useEffect(() => {
    setScope(initialScope)
  }, [initialScope])

  const loadPageData = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const characters = await fetchCharacters({ isPlayer: scope === "players" })

      setCharactersData(characters)
      if (loadRelatedData) {
        const references = await fetchCharacterReferences()
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
      } else {
        setLandmarkNamesById({})
        setBuildingNamesById({})
        setOrganizationNamesById({})
      }
    } catch (error) {
      setLoadError(getBackendErrorMessage(error, "No se pudieron cargar los personajes."))
      setCharactersData([])
      setLandmarkNamesById({})
      setBuildingNamesById({})
      setOrganizationNamesById({})
    } finally {
      setIsLoading(false)
    }
  }, [loadRelatedData, scope])

  useEffect(() => {
    void loadPageData()
  }, [loadPageData])

  useEffect(() => {
    const handleCharactersChanged = () => {
      void loadPageData()
    }

    window.addEventListener(CHARACTERS_CHANGED_EVENT, handleCharactersChanged)
    return () => {
      window.removeEventListener(CHARACTERS_CHANGED_EVENT, handleCharactersChanged)
    }
  }, [loadPageData])

  const getLandmarkName = (landmarkId: number) =>
    landmarkId > 0 ? (landmarkNamesById[landmarkId] ?? (loadRelatedData ? UNKNOWN_LABEL : `Ubicacion #${landmarkId}`)) : "Sin ubicacion"
  const getBuildingName = (buildingId: number) => buildingNamesById[buildingId] ?? UNKNOWN_LABEL
  const getOrganizationName = (organizationId: number) =>
    organizationNamesById[organizationId] ?? (loadRelatedData ? UNKNOWN_LABEL : "")

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
    [buildingNamesById, landmarkNamesById, loadRelatedData, organizationNamesById, scopedCharacters, searchQuery],
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

  const createCharacterAction = (
    <Button
      onClick={() => {
        setSelectedCharacter(null)
        setDialogOpen(true)
      }}
      className="gap-2"
    >
      <Plus className="size-4" />
      {scopeLabels.creationLabel}
    </Button>
  )

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-8">
      <EntitiesPageHeader
        showHeader={showHeader}
        title="Personajes"
        summary={
          <>
            {filteredCharacters.length} de {scopedCharacters.length} {scopeLabels.emptyLabel}
          </>
        }
        icon={<Swords className="size-5 text-primary" />}
        action={
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-sm border border-border bg-card p-1">
              {(Object.keys(CHARACTER_SCOPE_TAB_LABELS) as Array<keyof typeof CHARACTER_SCOPE_TAB_LABELS>).map((scopeOption) => {
                const isActive = scope === scopeOption
                return (
                  <Button
                    key={scopeOption}
                    type="button"
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className="h-8 px-3"
                    onClick={() => setScope(scopeOption)}
                  >
                    {CHARACTER_SCOPE_TAB_LABELS[scopeOption]}
                  </Button>
                )
              })}
            </div>
            {createCharacterAction}
          </div>
        }
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
            organizationNames={character.organizationIds.map((organizationId) => getOrganizationName(organizationId)).filter(Boolean)}
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
