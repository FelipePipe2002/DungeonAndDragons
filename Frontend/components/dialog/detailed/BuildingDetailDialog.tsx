"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MentionField } from "@/components/mentionField/MentionField"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  fetchCharacterReferences,
  fetchCharacters,
  type CharacterLandmarkReference,
} from "@/lib/services/character-api.service"
import { createBuilding, deleteBuilding, fetchBuildingById, updateBuilding } from "@/lib/services/building-api.service"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import { fetchOrganizations } from "@/lib/services/organization-api.service"
import type { Building, Character, Organization } from "@/lib/types"
import { Building2, MapPin, Pencil, Save, Search, Shield, Trash2, User, X } from "lucide-react"

type BuildingFormState = {
  nombre: string
  descripcion: string
  duenoId: number | null
  duenoNombre: string
  tags: string
  landmarkId: number
}

const EMPTY_BUILDING_FORM_STATE: BuildingFormState = {
  nombre: "",
  descripcion: "",
  duenoId: null,
  duenoNombre: "",
  tags: "",
  landmarkId: 0,
}

function formatOwnerLabel(character: Character, landmarkName?: string) {
  return [character.nombre, landmarkName, character.raza, character.clase]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join(" - ")
}

function toBuildingFormState(building: Building, characters: Character[]): BuildingFormState {
  const ownerName = building.duenoNombre?.trim() ?? ""
  const ownerByName =
    building.duenoId === undefined && ownerName.length > 0
      ? characters.find((character) => character.nombre.trim().toLowerCase() === ownerName.toLowerCase())
      : undefined

  return {
    nombre: building.nombre,
    descripcion: building.descripcion,
    duenoId: building.duenoId ?? ownerByName?.id ?? null,
    duenoNombre: ownerByName?.nombre ?? ownerName,
    tags: building.tags.join(", "),
    landmarkId: building.landmarkId ?? 0,
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

function getEmptyBuildingFormState(defaultLandmarkId: number): BuildingFormState {
  return {
    ...EMPTY_BUILDING_FORM_STATE,
    landmarkId: defaultLandmarkId,
  }
}

interface BuildingDetailDialogProps {
  buildingId?: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  resolveLandmarkName?: (landmarkId: number) => string
  resolveOrganizationName?: (organizationId: number) => string
  onBuildingUpdated?: (building: Building) => void
  onBuildingDeleted?: (buildingId: number) => void
  initialLandmarkId?: number
}

export function BuildingDetailDialog({
  buildingId,
  open,
  onOpenChange,
  resolveLandmarkName,
  resolveOrganizationName,
  onBuildingUpdated,
  onBuildingDeleted,
  initialLandmarkId,
}: BuildingDetailDialogProps) {
  const targetBuildingId = typeof buildingId === "number" ? buildingId : undefined
  const isCreateMode = typeof targetBuildingId !== "number"
  const [storedLandmarks, setStoredLandmarks] = useState<CharacterLandmarkReference[]>([])
  const [storedOrganizations, setStoredOrganizations] = useState<Organization[]>([])
  const [storedCharacters, setStoredCharacters] = useState<Character[]>([])
  const [currentBuilding, setCurrentBuilding] = useState<Building | null>(null)
  const [, setIsLoadingBuilding] = useState(false)
  const defaultLandmarkId = useMemo(() => {
    if (
      typeof initialLandmarkId === "number" &&
      storedLandmarks.some((landmark) => landmark.id === initialLandmarkId)
    ) {
      return initialLandmarkId
    }
    return storedLandmarks[0]?.id ?? 0
  }, [initialLandmarkId, storedLandmarks])
  const landmarkNameById = useMemo(
    () => new Map(storedLandmarks.map((landmark) => [landmark.id, landmark.nombre])),
    [storedLandmarks],
  )
  const organizationNameById = useMemo(() => {
    const byId = new Map(storedOrganizations.map((organization) => [organization.id, organization.nombre]))
    return byId
  }, [storedOrganizations])
  const characterById = useMemo(
    () => new Map(storedCharacters.map((character) => [character.id, character])),
    [storedCharacters],
  )
  const [isEditing, setIsEditing] = useState(false)
  const [isOwnerPickerOpen, setIsOwnerPickerOpen] = useState(false)
  const [ownerSearch, setOwnerSearch] = useState("")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [formState, setFormState] = useState<BuildingFormState>(() =>
    currentBuilding
      ? toBuildingFormState(currentBuilding, storedCharacters)
      : getEmptyBuildingFormState(defaultLandmarkId),
  )

  useEffect(() => {
    if (!open) return

    let isActive = true
    void fetchCharacters()
      .then((characters) => {
        if (isActive) {
          setStoredCharacters(characters)
        }
      })
      .catch(() => {
        if (isActive) {
          setStoredCharacters([])
        }
      })
    void fetchCharacterReferences()
      .then((references) => {
        if (isActive) {
          setStoredLandmarks(references.landmarks)
        }
      })
      .catch(() => {
        if (isActive) {
          setStoredLandmarks([])
        }
      })
    void fetchOrganizations()
      .then((organizations) => {
        if (isActive) {
          setStoredOrganizations(organizations)
        }
      })
      .catch(() => {
        if (isActive) {
          setStoredOrganizations([])
        }
      })

    return () => {
      isActive = false
    }
  }, [open, targetBuildingId])

  useEffect(() => {
    if (!open) return
    if (isCreateMode) {
      setCurrentBuilding(null)
      setIsLoadingBuilding(false)
      return
    }
    if (typeof targetBuildingId !== "number") return

    let isActive = true
    setIsLoadingBuilding(true)
    void fetchBuildingById(targetBuildingId)
      .then((building) => {
        if (isActive) {
          setCurrentBuilding(building)
        }
      })
      .catch(() => {
        if (isActive) {
          setCurrentBuilding(null)
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingBuilding(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [isCreateMode, open, targetBuildingId])

  useEffect(() => {
    if (!open) return

    setOwnerSearch("")
    setIsOwnerPickerOpen(false)
    setIsEditing(isCreateMode)
    setSaveError(null)
    setFormState(
      currentBuilding
        ? toBuildingFormState(currentBuilding, storedCharacters)
        : getEmptyBuildingFormState(defaultLandmarkId),
    )
  }, [currentBuilding, defaultLandmarkId, isCreateMode, open, storedCharacters])

  const activeLandmarkId = isEditing
    ? formState.landmarkId
    : currentBuilding
      ? (currentBuilding.landmarkId ?? 0)
      : defaultLandmarkId
  const landmarkName =
    activeLandmarkId > 0
      ? landmarkNameById.get(activeLandmarkId) ??
        resolveLandmarkName?.(activeLandmarkId) ??
        "Desconocido"
      : "Sin ubicacion"
  const organizationName = currentBuilding?.organizationId
    ? organizationNameById.get(currentBuilding.organizationId) ??
      resolveOrganizationName?.(currentBuilding.organizationId) ??
      "Desconocido"
    : null
  const titleText = isEditing
    ? formState.nombre.trim() || (isCreateMode ? "Nuevo edificio" : currentBuilding?.nombre ?? "Nuevo edificio")
    : currentBuilding?.nombre ?? "Nuevo edificio"
  const selectedOwner = formState.duenoId !== null ? characterById.get(formState.duenoId) : undefined
  const selectedOwnerLabel = selectedOwner
    ? formatOwnerLabel(selectedOwner, landmarkNameById.get(selectedOwner.landmarkId))
    : formState.duenoNombre.trim()
  const ownerOptions = useMemo(() => {
    const query = ownerSearch.trim().toLowerCase()
    const options = storedCharacters
      .map((character) => {
        const landmarkLabel = landmarkNameById.get(character.landmarkId)
        const label = formatOwnerLabel(character, landmarkLabel)
        const searchable = [character.nombre, landmarkLabel, character.raza, character.clase]
          .map((part) => part?.trim().toLowerCase() ?? "")
          .filter((part) => part.length > 0)
          .join(" ")

        return { character, label, searchable }
      })
      .filter((option) => (query.length === 0 ? true : option.searchable.includes(query)))
      .sort((a, b) => a.label.localeCompare(b.label, "es"))

    return options
  }, [landmarkNameById, ownerSearch, storedCharacters])

  const handleSelectOwner = (character: Character) => {
    setFormState((prev) => ({
      ...prev,
      duenoId: character.id,
      duenoNombre: character.nombre,
    }))
    setOwnerSearch("")
    setIsOwnerPickerOpen(false)
  }

  const handleClearOwner = () => {
    setFormState((prev) => ({
      ...prev,
      duenoId: null,
      duenoNombre: "",
    }))
    setOwnerSearch("")
    setIsOwnerPickerOpen(false)
  }

  const handleStartEdit = () => {
    if (!currentBuilding) return

    setFormState(toBuildingFormState(currentBuilding, storedCharacters))
    setOwnerSearch("")
    setIsOwnerPickerOpen(false)
    setIsEditing(true)
    setSaveError(null)
  }

  const handleCancelEdit = () => {
    if (!currentBuilding) {
      onOpenChange(false)
      return
    }

    setFormState(toBuildingFormState(currentBuilding, storedCharacters))
    setOwnerSearch("")
    setIsOwnerPickerOpen(false)
    setIsEditing(false)
    setSaveError(null)
  }

  const handleSaveEdit = () => {
    void (async () => {
      const normalizedName = formState.nombre.trim()
      if (!normalizedName) {
        setSaveError("El nombre del edificio es obligatorio.")
        return
      }
      const ownerFromSelection = formState.duenoId !== null ? characterById.get(formState.duenoId) : undefined
      const ownerId = formState.duenoId ?? undefined
      const ownerName = ownerFromSelection?.nombre ?? toOptionalText(formState.duenoNombre)

      try {
        if (!currentBuilding) {
          const nextLandmarkId = formState.landmarkId > 0 ? formState.landmarkId : null
          const createdBuilding = await createBuilding({
            landmarkId: nextLandmarkId,
            nombre: normalizedName,
            descripcion: formState.descripcion.trim(),
            tags: toTagList(formState.tags),
            duenoId: ownerId,
            duenoNombre: ownerName,
          })

          setCurrentBuilding(createdBuilding)
          setFormState(toBuildingFormState(createdBuilding, storedCharacters))
          setIsEditing(false)
          setSaveError(null)
          onBuildingUpdated?.(createdBuilding)
          return
        }

        const nextBuildingInput: Omit<Building, "id"> = {
          landmarkId: formState.landmarkId > 0 ? formState.landmarkId : null,
          nombre: normalizedName,
          descripcion: formState.descripcion.trim(),
          tags: toTagList(formState.tags),
          duenoId: ownerId,
          duenoNombre: ownerName,
          posicion: currentBuilding.posicion,
          mapBuildingIndex: currentBuilding.mapBuildingIndex,
          organizationId: currentBuilding.organizationId,
        }

        const updatedBuilding = await updateBuilding(currentBuilding.id, nextBuildingInput)

        setCurrentBuilding(updatedBuilding)
        setFormState(toBuildingFormState(updatedBuilding, storedCharacters))
        setIsEditing(false)
        setSaveError(null)
        onBuildingUpdated?.(updatedBuilding)
      } catch (error) {
        setSaveError(getBackendErrorMessage(error, "No se pudo guardar el edificio en backend."))
      }
    })()
  }

  const handleDelete = () => {
    if (!currentBuilding) return

    void (async () => {
      const confirmed = window.confirm(`¿Eliminar ${currentBuilding.nombre}? Esta accion no se puede deshacer.`)
      if (!confirmed) return

      try {
        await deleteBuilding(currentBuilding.id)
        setCurrentBuilding(null)
        setOwnerSearch("")
        setIsOwnerPickerOpen(false)
        setIsEditing(false)
        setSaveError(null)
        setFormState(getEmptyBuildingFormState(defaultLandmarkId))
        onBuildingDeleted?.(currentBuilding.id)
        onOpenChange(false)
      } catch (error) {
        setSaveError(getBackendErrorMessage(error, "No se pudo eliminar el edificio en backend."))
      }
    })()
  }

  const handleDialogOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)

    if (!nextOpen) {
      setOwnerSearch("")
      setIsOwnerPickerOpen(false)
      setIsEditing(isCreateMode)
      setSaveError(null)
      setFormState(
        currentBuilding
          ? toBuildingFormState(currentBuilding, storedCharacters)
          : getEmptyBuildingFormState(defaultLandmarkId),
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="parchment max-h-[90vh] max-w-3xl overflow-hidden p-0">
        <div className="absolute right-12 top-3.5 z-20 flex items-center gap-1.5">
          {!isEditing && currentBuilding ? (
            <>
              <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={handleDelete}>
                <Trash2 className="mr-1 size-3" />
                Eliminar
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleStartEdit}>
                <Pencil className="mr-1 size-3" />
                Editar
              </Button>
            </>
          ) : (
            <>
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

        <ScrollArea className="max-h-[90vh]">
          <div className="flex flex-col">
            <div className="scroll-banner">
              <DialogHeader>
                <div className="flex items-center gap-4">
                  <div className="flex size-14 items-center justify-center rounded-sm border-2 border-primary/30 bg-primary/10">
                    <Building2 className="size-7 text-primary" />
                  </div>
                  <div>
                    {isEditing ? (
                      <>
                        <DialogTitle className="sr-only">{titleText}</DialogTitle>
                        <Input
                          value={formState.nombre}
                          onChange={(event) =>
                            setFormState((prev) => ({ ...prev, nombre: event.target.value }))
                          }
                          className="h-9 border-primary/30 bg-card/80 font-serif text-lg"
                        />
                      </>
                    ) : (
                      <DialogTitle className="text-2xl font-serif text-primary">
                        {titleText}
                      </DialogTitle>
                    )}
                    <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="size-3" />
                      {landmarkName}
                    </div>
                    {!isEditing && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {(currentBuilding?.tags.length ?? 0) === 0 ? (
                          <span className="text-xs text-muted-foreground">Sin etiquetas</span>
                        ) : (
                          currentBuilding?.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="border-primary/30 text-[10px] text-primary">
                              {tag}
                            </Badge>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </DialogHeader>
            </div>

            <div className="flex flex-col gap-5 p-6">
              {saveError && <p className="text-xs text-destructive">{saveError}</p>}

              <div>
                <div className="ornament-divider mb-3 text-xs font-serif">Descripcion</div>
                {isEditing ? (
                  <MentionField
                    source="auto"
                    value={formState.descripcion}
                    onChange={(value) => setFormState((prev) => ({ ...prev, descripcion: value }))}
                    rows={4}
                    className="text-sm"
                    placeholder="Descripcion del edificio..."
                  />
                ) : (
                  <MentionField
                    source="auto"
                    value={currentBuilding?.descripcion ?? ""}
                    editable={false}
                    className="text-sm leading-relaxed text-foreground/85"
                    emptyText="Sin descripcion"
                  />
                )}
              </div>

              {isEditing && (
                <div>
                  <div className="ornament-divider mb-3 text-xs font-serif">Etiquetas</div>
                  <Input
                    value={formState.tags}
                    onChange={(event) => setFormState((prev) => ({ ...prev, tags: event.target.value }))}
                    className="text-sm"
                    placeholder="tags, separadas, por, coma"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-sm border border-border bg-secondary/50 p-3">
                  <h4 className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <MapPin className="size-3" /> Ubicacion
                  </h4>
                  {isEditing ? (
                    <select
                      value={formState.landmarkId}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          landmarkId: Number(event.target.value),
                        }))
                      }
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value={0}>Sin ubicacion</option>
                      {storedLandmarks.length > 0 &&
                        storedLandmarks.map((landmark) => (
                          <option key={landmark.id} value={landmark.id}>
                            {landmark.nombre}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <p className="text-sm text-foreground">{landmarkName}</p>
                  )}
                </div>

                {(isEditing || currentBuilding?.duenoNombre) && (
                  <div className="rounded-sm border border-border bg-secondary/50 p-3">
                    <h4 className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      <User className="size-3" /> Dueno
                    </h4>
                    {isEditing ? (
                      <Popover open={isOwnerPickerOpen} onOpenChange={setIsOwnerPickerOpen}>
                        <PopoverAnchor asChild>
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={isOwnerPickerOpen ? ownerSearch : selectedOwnerLabel}
                              onFocus={() => {
                                setOwnerSearch("")
                                setIsOwnerPickerOpen(true)
                              }}
                              onChange={(event) => {
                                setOwnerSearch(event.target.value)
                                setIsOwnerPickerOpen(true)
                              }}
                              className="h-8 border-border bg-card pl-8 text-xs"
                              placeholder="Buscar personaje para dueno..."
                            />
                          </div>
                        </PopoverAnchor>
                        <PopoverContent
                          align="start"
                          sideOffset={6}
                          className="w-[min(90vw,30rem)] border-border/70 p-1"
                        >
                          <ScrollArea className="max-h-72">
                            <div className="space-y-0.5">
                              <button
                                type="button"
                                onClick={handleClearOwner}
                                className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-secondary/60"
                              >
                                <span>Sin dueno</span>
                                <span className="text-primary">Limpiar</span>
                              </button>
                              {ownerOptions.length === 0 ? (
                                <p className="px-2 py-2 text-xs text-muted-foreground">No hay coincidencias.</p>
                              ) : (
                                ownerOptions.map((option) => (
                                  <button
                                    key={option.character.id}
                                    type="button"
                                    onClick={() => handleSelectOwner(option.character)}
                                    className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-secondary/60"
                                  >
                                    <span className="truncate pr-2">{option.label}</span>
                                    <span className="shrink-0 text-primary">Seleccionar</span>
                                  </button>
                                ))
                              )}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <p className="text-sm text-foreground">{currentBuilding?.duenoNombre}</p>
                    )}
                  </div>
                )}

                {currentBuilding?.organizationId && (
                  <div className="rounded-sm border border-border bg-secondary/50 p-3">
                    <h4 className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      <Shield className="size-3" /> Organizacion
                    </h4>
                    <p className="text-sm text-foreground">{organizationName}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
