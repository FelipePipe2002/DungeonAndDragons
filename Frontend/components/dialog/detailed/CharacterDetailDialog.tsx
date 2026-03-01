"use client"

import { useEffect, useMemo, useState, type ElementType, type ReactNode } from "react"
import { CharacterSheetDialog } from "@/components/dialog/detailed/CharacterSheetDialog"
import { CreateCharacterEventDialog } from "@/components/dialog/detailed/CreateCharacterEventDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ImageEmbeddingPicker } from "@/components/media/ImageEmbeddingPicker"
import { MentionField } from "@/components/mentionField/MentionField"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { normalizeCharacterSheet } from "@/lib/character-sheet"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import {
  createCharacter,
  deleteCharacter,
  fetchCharacterById,
  fetchCharacterReferences,
  updateCharacter,
  type CharacterBuildingReference,
  type CharacterLandmarkReference,
  type CharacterOrganizationReference,
} from "@/lib/services/character-api.service"
import type { Character, CharacterEvent } from "@/lib/types"
import { BookOpen, Building2, MapPin, Pencil, Plus, Save, Search, Shield, Trash2, X } from "lucide-react"

export interface CharacterDetailData {
  character: Character
  landmarkName: string
  buildingNames?: string[]
  organizationNames?: string[]
}

interface CharacterDetailDialogProps {
  characterId?: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCharacterUpdated?: (character: Character) => void
  onCharacterDeleted?: (characterId: number) => void
  initialLandmarkId?: number
  initialIsPlayer?: boolean
}

type CharacterFormState = {
  nombre: string
  clase: string
  raza: string
  descripcion: string
  isPlayer: boolean
  characterSheet: Character["characterSheet"]
  imagen: string
  imagenAssetId: number | null
  tags: string
  landmarkId: number
  buildingIds: number[]
  organizationIds: number[]
}

const EMPTY_CHARACTER_FORM_STATE: CharacterFormState = {
  nombre: "",
  clase: "",
  raza: "",
  descripcion: "",
  isPlayer: false,
  characterSheet: null,
  imagen: "",
  imagenAssetId: null,
  tags: "",
  landmarkId: 0,
  buildingIds: [],
  organizationIds: [],
}

type SelectableBuilding = CharacterBuildingReference
type SelectableOrganization = CharacterOrganizationReference
type IndexedCharacterEvent = { event: CharacterEvent; index: number }

function SectionDivider({ label }: { label: string }) {
  return <div className="ornament-divider mb-3 text-xs font-serif">{label}</div>
}

function InfoBox({
  icon: Icon,
  label,
  children,
}: {
  icon: ElementType
  label: string
  children: ReactNode
}) {
  return (
    <div className="rounded-sm border border-border bg-secondary/50 p-3">
      <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        <Icon className="size-3" /> {label}
      </h4>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  )
}

function toCharacterFormState(character: Character): CharacterFormState {
  return {
    nombre: character.nombre,
    clase: character.clase,
    raza: character.raza,
    descripcion: character.descripcion,
    isPlayer: character.isPlayer,
    characterSheet: character.characterSheet,
    imagen: character.imagen ?? "",
    imagenAssetId: character.imagenAssetId ?? null,
    tags: character.tags.join(", "),
    landmarkId: character.landmarkId,
    buildingIds: [...character.buildingIds],
    organizationIds: [...character.organizationIds],
  }
}

function toTagList(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    ),
  )
}

function toOptionalText(value: string): string | undefined {
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function getDefaultLandmarkInfo(landmarks: CharacterLandmarkReference[], initialLandmarkId?: number) {
  const preferredLandmark =
    typeof initialLandmarkId === "number"
      ? landmarks.find((landmark) => landmark.id === initialLandmarkId)
      : undefined
  if (!preferredLandmark) {
    return { id: 0, name: "Sin ubicacion" }
  }

  return {
    id: preferredLandmark.id,
    name: preferredLandmark.nombre,
  }
}

function resolveCharacterLandmarkName(
  landmarkId: number,
  landmarkNameById: Map<number, string>,
  fallback = "Sin ubicacion",
) {
  if (landmarkId <= 0) return "Sin ubicacion"
  return landmarkNameById.get(landmarkId) ?? fallback
}

function parseSessionNumber(value: string) {
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) {
    const parsed = Number.parseInt(trimmed, 10)
    return Number.isFinite(parsed) ? parsed : null
  }

  const matched = trimmed.match(/\d+/)
  if (!matched) return null
  const parsed = Number.parseInt(matched[0], 10)
  return Number.isFinite(parsed) ? parsed : null
}

function parseEventOrderNumber(value: string | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) {
    const parsed = Number.parseInt(trimmed, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }

  const matched = trimmed.match(/\d+/)
  if (!matched) return null
  const parsed = Number.parseInt(matched[0], 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function getEventOrderSortValue(event: CharacterEvent) {
  const parsed = parseEventOrderNumber(event.fecha)
  return parsed ?? -1
}

function getEventSessionSortValue(event: CharacterEvent) {
  const parsed = parseSessionNumber(event.sesion)
  return parsed ?? -1
}

function formatEventSessionLabel(event: CharacterEvent) {
  const parsed = parseSessionNumber(event.sesion)
  return parsed !== null ? `Sesion ${parsed}` : event.sesion
}

function formatEventOrderLabel(event: CharacterEvent) {
  const parsed = parseEventOrderNumber(event.fecha)
  return parsed !== null ? `Orden ${parsed}` : "Sin orden"
}

function getEmptyCharacterFormState(
  defaultLandmarkId: number,
  initialIsPlayer = false,
): CharacterFormState {
  return {
    ...EMPTY_CHARACTER_FORM_STATE,
    isPlayer: initialIsPlayer,
    landmarkId: defaultLandmarkId,
  }
}

export function CharacterDetailDialog({
  characterId,
  open,
  onOpenChange,
  onCharacterUpdated,
  onCharacterDeleted,
  initialLandmarkId,
  initialIsPlayer = false,
}: CharacterDetailDialogProps) {
  const targetCharacterId = typeof characterId === "number" ? characterId : undefined
  const [storedLandmarks, setStoredLandmarks] = useState<CharacterLandmarkReference[]>([])
  const [storedBuildings, setStoredBuildings] = useState<CharacterBuildingReference[]>([])
  const [storedOrganizations, setStoredOrganizations] = useState<CharacterOrganizationReference[]>([])
  const [currentCharacterData, setCurrentCharacterData] = useState<CharacterDetailData | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const defaultLandmark = useMemo(
    () => getDefaultLandmarkInfo(storedLandmarks, initialLandmarkId),
    [storedLandmarks, initialLandmarkId],
  )

  const landmarkNameById = useMemo(
    () => new Map(storedLandmarks.map((item) => [item.id, item.nombre])),
    [storedLandmarks],
  )
  const buildingNameById = useMemo(
    () => new Map(storedBuildings.map((item) => [item.id, item.nombre])),
    [storedBuildings],
  )
  const organizationNameById = useMemo(
    () => new Map(storedOrganizations.map((item) => [item.id, item.nombre])),
    [storedOrganizations],
  )
  const [eventSearch, setEventSearch] = useState("")
  const [isCreateEventDialogOpen, setIsCreateEventDialogOpen] = useState(false)
  const [isCharacterSheetDialogOpen, setIsCharacterSheetDialogOpen] = useState(false)
  const [editingEventIndex, setEditingEventIndex] = useState<number | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [eventSaveError, setEventSaveError] = useState<string | null>(null)
  const [formState, setFormState] = useState<CharacterFormState>(
    getEmptyCharacterFormState(0, initialIsPlayer),
  )

  const isCreateMode = currentCharacterData === null

  const character = useMemo<Character>(
    () =>
      currentCharacterData?.character ?? {
        id: 0,
        nombre: "",
        clase: "",
        raza: "",
        descripcion: "",
        isPlayer: false,
        characterSheet: null,
        tags: [],
        landmarkId: defaultLandmark.id,
        buildingIds: [],
        organizationIds: [],
        eventos: [],
      },
    [currentCharacterData, defaultLandmark.id],
  )

  const fallbackLandmarkName = currentCharacterData?.landmarkName ?? defaultLandmark.name

  const landmarkName = useMemo(() => {
    const targetLandmarkId = isEditing ? formState.landmarkId : character.landmarkId
    return resolveCharacterLandmarkName(targetLandmarkId, landmarkNameById, fallbackLandmarkName)
  }, [character.landmarkId, fallbackLandmarkName, formState.landmarkId, isEditing, landmarkNameById])

  const ownedBuildingIds = useMemo(
    () =>
      character.id > 0
        ? storedBuildings
            .filter((building) => building.duenoId === character.id)
            .map((building) => building.id)
        : [],
    [character.id, storedBuildings],
  )
  const ownedBuildingIdSet = useMemo(() => new Set(ownedBuildingIds), [ownedBuildingIds])
  const displayBuildingIds = useMemo(
    () => Array.from(new Set([...character.buildingIds, ...ownedBuildingIds])),
    [character.buildingIds, ownedBuildingIds],
  )
  const buildingNames = useMemo(
    () => displayBuildingIds.map((buildingId) => buildingNameById.get(buildingId) ?? "Desconocido"),
    [buildingNameById, displayBuildingIds],
  )
  const organizationNames = useMemo(
    () =>
      character.organizationIds.map(
        (organizationId) => organizationNameById.get(organizationId) ?? "Desconocido",
      ),
    [character.organizationIds, organizationNameById],
  )

  const availableBuildings = useMemo(() => {
    return [...storedBuildings]
      .map((building): SelectableBuilding => ({
        id: building.id,
        nombre: building.nombre,
        landmarkId: building.landmarkId,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
  }, [storedBuildings])

  const availableOrganizations = useMemo(() => {
    return [...storedOrganizations]
      .map((organization): SelectableOrganization => ({
        id: organization.id,
        nombre: organization.nombre,
        landmarks: organization.landmarks,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
  }, [storedOrganizations])

  const previewTags = isEditing ? toTagList(formState.tags) : character.tags
  const previewImage = isEditing ? toOptionalText(formState.imagen) : character.imagen
  const previewIsPlayer = isEditing ? formState.isPlayer : character.isPlayer
  const previewHasCharacterSheet = character.characterSheet !== null
  const previewName = isEditing
    ? formState.nombre.trim() || (isCreateMode ? "Nuevo personaje" : character.nombre)
    : character.nombre || "Nuevo personaje"

  useEffect(() => {
    if (!open) return

    let cancelled = false

    async function loadDialogData() {
      setIsLoadingData(true)
      setLoadError(null)
      setSaveError(null)
      setEventSaveError(null)
      setEventSearch("")
      setIsCharacterSheetDialogOpen(false)
      setIsCreateEventDialogOpen(false)
      setEditingEventIndex(null)

      try {
        const references = await fetchCharacterReferences(true)
        if (cancelled) return

        setStoredLandmarks(references.landmarks)
        setStoredBuildings(references.buildings)
        setStoredOrganizations(references.organizations)

        const resolvedDefaultLandmark = getDefaultLandmarkInfo(references.landmarks, initialLandmarkId)

        if (typeof targetCharacterId !== "number") {
          setCurrentCharacterData(null)
          setFormState(getEmptyCharacterFormState(resolvedDefaultLandmark.id, initialIsPlayer))
          setIsEditing(true)
          return
        }

        const loadedCharacter = await fetchCharacterById(targetCharacterId)
        if (cancelled) return

        const resolvedLandmarkName = resolveCharacterLandmarkName(
          loadedCharacter.landmarkId,
          new Map(references.landmarks.map((landmark) => [landmark.id, landmark.nombre])),
          resolvedDefaultLandmark.name,
        )

        setCurrentCharacterData({
          character: loadedCharacter,
          landmarkName: resolvedLandmarkName,
        })
        setFormState(toCharacterFormState(loadedCharacter))
        setIsEditing(false)
      } catch (error) {
        if (cancelled) return

        setLoadError(getBackendErrorMessage(error, "No se pudo cargar el personaje."))
        setCurrentCharacterData(null)
        setFormState(getEmptyCharacterFormState(0, initialIsPlayer))
        setIsEditing(false)
      } finally {
        if (!cancelled) {
          setIsLoadingData(false)
        }
      }
    }

    void loadDialogData()
    return () => {
      cancelled = true
    }
  }, [initialIsPlayer, initialLandmarkId, open, targetCharacterId])

  const filteredEvents = useMemo(() => {
    const sortedEvents: IndexedCharacterEvent[] = character.eventos
      .map((event, index) => ({ event, index }))
      .sort((left, right) => {
        const sessionDiff =
          getEventSessionSortValue(right.event) - getEventSessionSortValue(left.event)
        if (sessionDiff !== 0) return sessionDiff

        const orderDiff = getEventOrderSortValue(right.event) - getEventOrderSortValue(left.event)
        if (orderDiff !== 0) return orderDiff

        return left.index - right.index
      })

    if (!eventSearch.trim()) return sortedEvents
    const q = eventSearch.toLowerCase()

    return sortedEvents.filter(
      ({ event }) =>
        event.sesion.toLowerCase().includes(q) ||
        event.descripcion.toLowerCase().includes(q) ||
        (event.fecha && event.fecha.toLowerCase().includes(q)),
    )
  }, [character.eventos, eventSearch])

  const editingEvent = useMemo(() => {
    if (editingEventIndex == null) return null
    return character.eventos[editingEventIndex] ?? null
  }, [character.eventos, editingEventIndex])

  const handleStartEdit = () => {
    if (!currentCharacterData) return

    setFormState(toCharacterFormState(currentCharacterData.character))
    setIsEditing(true)
    setSaveError(null)
  }

  const handleCancelEdit = () => {
    if (!currentCharacterData) {
      onOpenChange(false)
      return
    }

    setFormState(toCharacterFormState(currentCharacterData.character))
    setIsEditing(false)
    setSaveError(null)
  }

  const handleToggleBuilding = (buildingId: number, checked: boolean) => {
    setFormState((prev) => ({
      ...prev,
      buildingIds: checked
        ? Array.from(new Set([...prev.buildingIds, buildingId]))
        : prev.buildingIds.filter((item) => item !== buildingId),
    }))
  }

  const handleToggleOrganization = (organizationId: number, checked: boolean) => {
    setFormState((prev) => ({
      ...prev,
      organizationIds: checked
        ? Array.from(new Set([...prev.organizationIds, organizationId]))
        : prev.organizationIds.filter((item) => item !== organizationId),
    }))
  }

  const handleOpenCharacterSheetDialog = () => {
    if (!currentCharacterData) {
      setSaveError("Guarda el personaje antes de crear o editar la hoja.")
      return
    }

    setSaveError(null)
    setIsCharacterSheetDialogOpen(true)
  }

  const handleSaveCharacterSheet = async (nextSheet: Character["characterSheet"]) => {
    if (!currentCharacterData) {
      setSaveError("Guarda el personaje antes de crear o editar la hoja.")
      return false
    }

    const normalizedSheet =
      nextSheet == null
        ? null
        : normalizeCharacterSheet(nextSheet, {
            nombre: currentCharacterData.character.nombre,
            raza: currentCharacterData.character.raza,
            clase: currentCharacterData.character.clase,
          })

    const { id: _characterId, ...characterInput } = {
      ...currentCharacterData.character,
      characterSheet: normalizedSheet,
    }

    try {
      const savedCharacter = await updateCharacter(currentCharacterData.character.id, characterInput)
      const resolvedLandmarkName = resolveCharacterLandmarkName(
        savedCharacter.landmarkId,
        landmarkNameById,
        defaultLandmark.name,
      )

      setCurrentCharacterData({
        character: savedCharacter,
        landmarkName: resolvedLandmarkName,
      })
      setSaveError(null)
      onCharacterUpdated?.(savedCharacter)
      return true
    } catch (error) {
      setSaveError(getBackendErrorMessage(error, "No se pudo guardar la hoja de personaje."))
      return false
    }
  }

  const handleSaveEdit = async () => {
    const normalizedName = formState.nombre.trim()
    if (!normalizedName) {
      setSaveError("El nombre del personaje es obligatorio.")
      return
    }

    const nextLandmarkId = formState.landmarkId > 0 ? formState.landmarkId : 0
    const normalizedCharacterSheet = normalizeCharacterSheet(formState.characterSheet, {
      nombre: normalizedName,
      raza: formState.raza,
      clase: formState.clase,
    })

    const characterInput: Omit<Character, "id"> = {
      nombre: normalizedName,
      clase: formState.clase.trim(),
      raza: formState.raza.trim(),
      descripcion: formState.descripcion.trim(),
      isPlayer: formState.isPlayer,
      characterSheet: currentCharacterData?.character.characterSheet ?? normalizedCharacterSheet,
      imagen: formState.imagenAssetId ? undefined : toOptionalText(formState.imagen),
      imagenAssetId: formState.imagenAssetId ?? undefined,
      tags: toTagList(formState.tags),
      landmarkId: nextLandmarkId,
      buildingIds: Array.from(new Set(formState.buildingIds)),
      organizationIds: Array.from(new Set(formState.organizationIds)),
      eventos: currentCharacterData?.character.eventos ?? [],
    }

    try {
      const savedCharacter =
        currentCharacterData == null
          ? await createCharacter(characterInput)
          : await updateCharacter(currentCharacterData.character.id, characterInput)

      const resolvedLandmarkName = resolveCharacterLandmarkName(
        savedCharacter.landmarkId,
        landmarkNameById,
        defaultLandmark.name,
      )
      setCurrentCharacterData({
        character: savedCharacter,
        landmarkName: resolvedLandmarkName,
      })
      setFormState(toCharacterFormState(savedCharacter))
      setIsCharacterSheetDialogOpen(false)
      setIsEditing(false)
      setSaveError(null)
      onCharacterUpdated?.(savedCharacter)
    } catch (error) {
      setSaveError(getBackendErrorMessage(error, "No se pudo guardar el personaje."))
    }
  }

  const handleOpenCreateEventDialog = () => {
    if (!currentCharacterData) {
      setEventSaveError("Guarda el personaje antes de agregar notas de sesion.")
      return
    }

    setEventSaveError(null)
    setEditingEventIndex(null)
    setIsCreateEventDialogOpen(true)
  }

  const handleOpenEditEventDialog = (eventIndex: number) => {
    if (!currentCharacterData) {
      setEventSaveError("Guarda el personaje antes de editar notas de sesion.")
      return
    }

    setEventSaveError(null)
    setEditingEventIndex(eventIndex)
    setIsCreateEventDialogOpen(true)
  }

  const handleSaveEvent = async (event: CharacterEvent) => {
    if (!currentCharacterData) {
      setEventSaveError("Guarda el personaje antes de agregar notas de sesion.")
      return false
    }

    const nextEvents = [...currentCharacterData.character.eventos]
    if (editingEventIndex == null) {
      nextEvents.unshift(event)
    } else if (editingEventIndex >= 0 && editingEventIndex < nextEvents.length) {
      nextEvents[editingEventIndex] = event
    } else {
      nextEvents.unshift(event)
    }

    const nextCharacter: Character = {
      ...currentCharacterData.character,
      eventos: nextEvents,
    }

    try {
      const { id: _characterId, ...characterInput } = nextCharacter
      const updatedCharacter = await updateCharacter(currentCharacterData.character.id, characterInput)
      const resolvedLandmarkName =
        resolveCharacterLandmarkName(
          updatedCharacter.landmarkId,
          landmarkNameById,
          currentCharacterData.landmarkName,
        )

      setCurrentCharacterData({
        character: updatedCharacter,
        landmarkName: resolvedLandmarkName,
      })
      setEventSearch("")
      setEventSaveError(null)
      setEditingEventIndex(null)
      onCharacterUpdated?.(updatedCharacter)
      return true
    } catch (error) {
      setEventSaveError(getBackendErrorMessage(error, "No se pudo guardar la nota de sesion."))
      return false
    }
  }

  const handleDelete = async () => {
    if (!currentCharacterData) return

    const targetCharacter = currentCharacterData.character
    const confirmed = window.confirm(`¿Eliminar a ${targetCharacter.nombre}? Esta accion no se puede deshacer.`)
    if (!confirmed) return

    try {
      await deleteCharacter(targetCharacter.id)
      setCurrentCharacterData(null)
      setFormState(getEmptyCharacterFormState(defaultLandmark.id))
      setEventSearch("")
      setIsCharacterSheetDialogOpen(false)
      setIsCreateEventDialogOpen(false)
      setEditingEventIndex(null)
      setIsEditing(false)
      setSaveError(null)
      setEventSaveError(null)
      setLoadError(null)
      onCharacterDeleted?.(targetCharacter.id)
      onOpenChange(false)
    } catch (error) {
      setSaveError(getBackendErrorMessage(error, "No se pudo eliminar el personaje."))
    }
  }

  const handleDialogOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)

    if (!nextOpen) {
      setEventSearch("")
      setIsCharacterSheetDialogOpen(false)
      setIsCreateEventDialogOpen(false)
      setEditingEventIndex(null)
      setIsEditing(false)
      setSaveError(null)
      setEventSaveError(null)
      setLoadError(null)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="parchment max-h-[90vh] max-w-7xl overflow-hidden p-0">
        <div className="absolute right-12 top-3.5 z-20 flex items-center gap-1.5">
          {!isEditing && currentCharacterData ? (
            <>
              <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={handleDelete}>
                <Trash2 className="mr-1 size-3" />
                Eliminar
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleOpenCharacterSheetDialog}>
                <BookOpen className="mr-1 size-3" />
                Hoja
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleStartEdit}>
                <Pencil className="mr-1 size-3" />
                Editar
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={handleOpenCharacterSheetDialog}
                disabled={!currentCharacterData}
              >
                <BookOpen className="mr-1 size-3" />
                {previewHasCharacterSheet ? "Editar hoja" : "Crear hoja"}
              </Button>
              <Button size="sm" className="h-7 px-2 text-xs" onClick={handleSaveEdit}>
                <Save className="mr-1 size-3" />
                Guardar
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleCancelEdit}>
                <X className="mr-1 size-3" />
                Cancelar
              </Button>
            </>
          )}
        </div>

        <div className="flex h-[85vh] min-h-0">
          <ScrollArea className="min-h-0 min-w-0 flex-1">
            <div className="flex flex-col">
              <div className="scroll-banner">
                <DialogHeader>
                  <div className="flex gap-5">
                    <div className="w-48 shrink-0">
                      <ImageEmbeddingPicker
                        usage="character"
                        value={previewImage}
                        assetId={formState.imagenAssetId}
                        onChange={(nextValue, nextAssetId) =>
                          setFormState((prev) => ({
                            ...prev,
                            imagen: nextValue,
                            imagenAssetId: nextAssetId,
                          }))
                        }
                        label="Imagen del personaje"
                        previewClassName="h-60 w-full"
                        editable={isEditing}
                        onRequestEdit={currentCharacterData ? handleStartEdit : undefined}
                      />
                    </div>
                    <div className="min-w-0 flex flex-col gap-1.5">
                      {isEditing ? (
                        <>
                          <DialogTitle className="sr-only">{previewName}</DialogTitle>
                          <Input
                            value={formState.nombre}
                            onChange={(event) =>
                              setFormState((prev) => ({ ...prev, nombre: event.target.value }))
                            }
                            className="h-9 border-primary/30 bg-card/80 font-serif text-lg"
                          />
                        </>
                      ) : (
                        <DialogTitle className="text-balance text-2xl font-serif leading-tight text-primary">
                          {previewName}
                        </DialogTitle>
                      )}

                      {isEditing ? (
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            value={formState.clase}
                            onChange={(event) =>
                              setFormState((prev) => ({ ...prev, clase: event.target.value }))
                            }
                            className="h-8 text-sm"
                            placeholder="Clase"
                          />
                          <Input
                            value={formState.raza}
                            onChange={(event) =>
                              setFormState((prev) => ({ ...prev, raza: event.target.value }))
                            }
                            className="h-8 text-sm"
                            placeholder="Raza"
                          />
                          <select
                            value={formState.landmarkId}
                            onChange={(event) =>
                              setFormState((prev) => ({
                                ...prev,
                                landmarkId: Number(event.target.value),
                              }))
                            }
                            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                          >
                            <option value={0}>Sin ubicacion</option>
                            {storedLandmarks.map((landmark) => (
                              <option key={landmark.id} value={landmark.id}>
                                {landmark.nombre}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-semibold text-foreground">{character.clase}</span>
                          <span className="text-primary/30">/</span>
                          <span className="text-muted-foreground">{character.raza}</span>
                          {character.isPlayer ? (
                            <Badge variant="outline" className="border-primary/30 text-[10px] text-primary">
                              Jugador
                            </Badge>
                          ) : null}
                          {character.characterSheet ? (
                            <Badge variant="secondary" className="text-[10px]">
                              Hoja cargada
                            </Badge>
                          ) : null}
                        </div>
                      )}

                      {isEditing ? (
                        <label className="flex items-center gap-2 text-xs text-foreground">
                          <Checkbox
                            checked={formState.isPlayer}
                            onCheckedChange={(value) =>
                              setFormState((prev) => ({
                                ...prev,
                                isPlayer: value === true,
                              }))
                            }
                          />
                          Es jugador
                          <span className="text-muted-foreground">
                            {previewHasCharacterSheet ? "Hoja cargada" : "Sin hoja"}
                          </span>
                        </label>
                      ) : null}

                      {!isEditing ? (
                        <div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="size-3" />
                            {landmarkName}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {previewTags.map((tag) => (
                              <Badge key={tag} variant="outline" className="border-primary/30 text-[10px] text-primary">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        ) : null}
                    </div>
                  </div>
                </DialogHeader>
              </div>

              <div className="flex flex-col gap-5 p-6">
                {isLoadingData && <p className="text-xs text-muted-foreground">Cargando personaje...</p>}
                {loadError && <p className="text-xs text-destructive">{loadError}</p>}
                {saveError && <p className="text-xs text-destructive">{saveError}</p>}

                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={previewIsPlayer ? "default" : "outline"}
                    className="text-[10px]"
                  >
                    {previewIsPlayer ? "Jugador" : "NPC"}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {previewHasCharacterSheet ? "Hoja cargada" : "Sin hoja"}
                  </Badge>
                </div>

                <div>
                  <SectionDivider label="Descripcion" />
                  {isEditing ? (
                    <MentionField
                      source="auto"
                      value={formState.descripcion}
                      onChange={(value) => setFormState((prev) => ({ ...prev, descripcion: value }))}
                      rows={5}
                      className="text-sm"
                      placeholder="Descripcion del personaje..."
                    />
                  ) : (
                    <MentionField
                      source="auto"
                      value={character.descripcion}
                      editable={false}
                      className="text-sm leading-relaxed text-foreground/85"
                      emptyText="Sin descripcion"
                    />
                  )}
                </div>

                {isEditing && (
                  <div>
                    <SectionDivider label="Etiquetas" />
                    <Input
                      value={formState.tags}
                      onChange={(event) => setFormState((prev) => ({ ...prev, tags: event.target.value }))}
                      className="h-8 text-sm"
                      placeholder="tag1, tag2, tag3"
                    />
                  </div>
                )}

                {isEditing ? (
                  <div className="grid grid-cols-2 gap-3">
                    <InfoBox icon={Building2} label="Vincular edificios">
                      {availableBuildings.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No hay edificios disponibles</span>
                      ) : (
                        <ScrollArea className="max-h-40 pr-2">
                          <div className="space-y-1.5">
                            {availableBuildings.map((building) => {
                              const isOwnerBuilding = ownedBuildingIdSet.has(building.id)
                              const isChecked = isOwnerBuilding || formState.buildingIds.includes(building.id)
                              const buildingLandmarkName =
                                typeof building.landmarkId === "number"
                                  ? (landmarkNameById.get(building.landmarkId) ?? "Desconocido")
                                  : "Sin ubicacion"

                              return (
                                <label
                                  key={building.id}
                                  className="flex cursor-pointer items-start gap-2 rounded-sm border border-border/60 bg-background/60 p-2 hover:bg-secondary/40"
                                >
                                  <Checkbox
                                    checked={isChecked}
                                    disabled={isOwnerBuilding}
                                    onCheckedChange={(value) =>
                                      handleToggleBuilding(building.id, value === true)
                                    }
                                  />
                                  <span className="flex flex-col leading-tight">
                                    <span className="text-xs font-medium text-foreground">
                                      {building.nombre}
                                      {isOwnerBuilding ? " (Dueno)" : ""}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {buildingLandmarkName}
                                    </span>
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        </ScrollArea>
                      )}
                    </InfoBox>

                    <InfoBox icon={Shield} label="Vincular organizaciones">
                      {availableOrganizations.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          No hay organizaciones disponibles
                        </span>
                      ) : (
                        <ScrollArea className="max-h-40 pr-2">
                          <div className="space-y-1.5">
                            {availableOrganizations.map((organization) => {
                              const isChecked = formState.organizationIds.includes(organization.id)

                              return (
                                <label
                                  key={organization.id}
                                  className="flex cursor-pointer items-start gap-2 rounded-sm border border-border/60 bg-background/60 p-2 hover:bg-secondary/40"
                                >
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(value) =>
                                      handleToggleOrganization(organization.id, value === true)
                                    }
                                  />
                                  <span className="text-xs font-medium text-foreground">
                                    {organization.nombre}
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        </ScrollArea>
                      )}
                    </InfoBox>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {buildingNames.length > 0 && (
                      <InfoBox icon={Building2} label="Edificios">
                        {buildingNames.map((buildingName, index) => (
                          <span key={`${buildingName}-${index}`} className="text-sm text-foreground">
                            {buildingName}
                          </span>
                        ))}
                      </InfoBox>
                    )}
                    {organizationNames.length > 0 && (
                      <InfoBox icon={Shield} label="Organizaciones">
                        {organizationNames.map((organizationName, index) => (
                          <span key={`${organizationName}-${index}`} className="text-sm text-foreground">
                            {organizationName}
                          </span>
                        ))}
                      </InfoBox>
                    )}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <div className="hidden w-[420px] shrink-0 min-h-0 flex-col border-l border-border bg-secondary/40 md:flex">
            <div className="flex flex-col gap-2 border-b border-border px-4 pb-4 pt-12">
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 text-primary" />
                <h3 className="font-serif text-sm font-semibold text-primary">Notas de Sesion</h3>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6 text-muted-foreground hover:text-primary"
                  onClick={handleOpenCreateEventDialog}
                >
                  <Plus className="size-3.5" />
                  <span className="sr-only">Agregar nota de sesion</span>
                </Button>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {filteredEvents.length} de {character.eventos.length}
                </span>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar eventos..."
                  value={eventSearch}
                  onChange={(event) => setEventSearch(event.target.value)}
                  className="h-8 border-border bg-card pl-8 text-xs"
                />
              </div>
              {eventSaveError && <p className="text-xs text-destructive">{eventSaveError}</p>}
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-2 p-4">
                {filteredEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <BookOpen className="mb-2 size-8 opacity-20" />
                    <span className="text-xs">
                      {character.eventos.length === 0 ? "Sin notas de sesion" : "Sin resultados"}
                    </span>
                  </div>
                ) : (
                  filteredEvents.map(({ event, index }) => (
                    <div
                      key={`${index}-${event.sesion}-${event.fecha ?? ""}`}
                      className="relative rounded-sm border border-border bg-card p-3 pl-4"
                    >
                      <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-primary/50" />
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="font-serif text-xs font-bold text-primary">{formatEventSessionLabel(event)}</span>
                        <span className="text-[10px] text-muted-foreground">{formatEventOrderLabel(event)}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="ml-auto size-6 text-muted-foreground hover:text-primary"
                          onClick={() => handleOpenEditEventDialog(index)}
                        >
                          <Pencil className="size-3.5" />
                          <span className="sr-only">Editar nota de sesion</span>
                        </Button>
                      </div>
                      <p className="text-xs leading-relaxed text-foreground/80">{event.descripcion}</p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="border-t border-border p-4 md:hidden">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <h3 className="font-serif text-sm font-semibold text-primary">Notas de Sesion</h3>
            <Button
              size="icon"
              variant="ghost"
              className="size-6 text-muted-foreground hover:text-primary"
              onClick={handleOpenCreateEventDialog}
            >
              <Plus className="size-3.5" />
              <span className="sr-only">Agregar nota de sesion</span>
            </Button>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {filteredEvents.length} de {character.eventos.length}
            </span>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar eventos..."
              value={eventSearch}
              onChange={(event) => setEventSearch(event.target.value)}
              className="h-8 border-border bg-card pl-8 text-xs"
            />
          </div>
          {eventSaveError && <p className="mb-3 text-xs text-destructive">{eventSaveError}</p>}
          <ScrollArea className="max-h-[55vh]">
            <div className="flex flex-col gap-2">
              {filteredEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <BookOpen className="mb-2 size-8 opacity-20" />
                  <span className="text-xs">
                    {character.eventos.length === 0 ? "Sin notas de sesion" : "Sin resultados"}
                  </span>
                </div>
              ) : (
                filteredEvents.map(({ event, index }) => (
                  <div
                    key={`${index}-${event.sesion}-${event.fecha ?? ""}`}
                    className="relative rounded-sm border border-border bg-card p-3 pl-4"
                  >
                    <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-primary/50" />
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-serif text-xs font-bold text-primary">{formatEventSessionLabel(event)}</span>
                      <span className="text-[10px] text-muted-foreground">{formatEventOrderLabel(event)}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="ml-auto size-6 text-muted-foreground hover:text-primary"
                        onClick={() => handleOpenEditEventDialog(index)}
                      >
                        <Pencil className="size-3.5" />
                        <span className="sr-only">Editar nota de sesion</span>
                      </Button>
                    </div>
                    <p className="text-xs leading-relaxed text-foreground/80">{event.descripcion}</p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
        </DialogContent>
      </Dialog>

      <CreateCharacterEventDialog
        open={isCreateEventDialogOpen}
        onOpenChange={(nextOpen) => {
          setIsCreateEventDialogOpen(nextOpen)
          if (!nextOpen) {
            setEditingEventIndex(null)
            setEventSaveError(null)
          }
        }}
        initialEvent={editingEvent}
        mode={editingEvent ? "edit" : "create"}
        onSaveEvent={handleSaveEvent}
      />

      <CharacterSheetDialog
        open={isCharacterSheetDialogOpen}
        onOpenChange={setIsCharacterSheetDialogOpen}
        value={currentCharacterData?.character.characterSheet ?? null}
        onSave={handleSaveCharacterSheet}
        characterName={currentCharacterData?.character.nombre ?? formState.nombre.trim()}
        characterRace={currentCharacterData?.character.raza ?? formState.raza.trim()}
        characterClass={currentCharacterData?.character.clase ?? formState.clase.trim()}
      />
    </>
  )
}
