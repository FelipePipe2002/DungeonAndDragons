"use client"

import { useEffect, useState, type ReactNode } from "react"

import { DetailDialogShell } from "@/components/dialog/shared/detail-dialog-shell"
import { ImageEmbeddingPicker } from "@/components/media/ImageEmbeddingPicker"
import { MentionField } from "@/components/mentionField/MentionField"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toOptionalText } from "@/lib/normalize"
import { cn } from "@/lib/utils"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import { fetchCharacters } from "@/lib/services/character-api.service"
import { createEstado, deleteEstado, fetchEstadoById, fetchEstados, updateEstado } from "@/lib/services/estado-api.service"
import { fetchLandmarkReferences } from "@/lib/services/landmark-api.service"
import type { Character, Estado, EstadoLandmarkRole, EstadoMemberRole } from "@/lib/types"
import { Crown, GitBranch, MapPin, MapPinned, Pencil, Plus, Save, Shield, Trash2, Users, X } from "lucide-react"

type EstadoFormState = {
  nombre: string
  tipo: string
  gobiernoTipo: string
  descripcion: string
  historia: string
  imagen: string
  imagenAssetId: number | null
  territorioImagen: string
  territorioImagenAssetId: number | null
  estadoPadreId: number | null
  miembros: EstadoMemberRole[]
  landmarks: EstadoLandmarkRole[]
  subdivisionDraft: string
}

const EMPTY_STATE: EstadoFormState = {
  nombre: "",
  tipo: "",
  gobiernoTipo: "",
  descripcion: "",
  historia: "",
  imagen: "",
  imagenAssetId: null,
  territorioImagen: "",
  territorioImagenAssetId: null,
  estadoPadreId: null,
  miembros: [],
  landmarks: [],
  subdivisionDraft: "",
}

function toEstadoFormState(estado: Estado): EstadoFormState {
  return {
    nombre: estado.nombre,
    tipo: estado.tipo,
    gobiernoTipo: estado.gobiernoTipo,
    descripcion: estado.descripcion,
    historia: estado.historia,
    imagen: estado.imagen ?? "",
    imagenAssetId: estado.imagenAssetId ?? null,
    territorioImagen: estado.territorioImagen ?? "",
    territorioImagenAssetId: estado.territorioImagenAssetId ?? null,
    estadoPadreId: estado.estadoPadreId ?? null,
    miembros: estado.miembros.map((m) => ({ ...m })),
    landmarks: estado.landmarks.map((l) => ({ ...l })),
    subdivisionDraft: "",
  }
}

function normalizeRole(value: string) {
  return value.trim()
}

function CouncilCard({
  title,
  subtitle,
  image,
  fallbackIcon,
  right,
  onClick,
  className,
}: {
  title: string
  subtitle?: string
  image?: string
  fallbackIcon?: ReactNode
  right?: ReactNode
  onClick?: () => void
  className?: string
}) {
  const content = (
    <>
      <div className="size-11 shrink-0">
        {image ? (
          <ImageEmbeddingPicker
            usage="character"
            value={image}
            onChange={() => {}}
            label={title}
            previewClassName="size-11 border-border/70 bg-muted/30"
            editable={false}
          />
        ) : (
          <div className="relative flex size-11 items-center justify-center overflow-hidden rounded-sm border border-border/70 bg-muted/30">
            {fallbackIcon ? fallbackIcon : <Shield className="size-5 text-muted-foreground" />}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{subtitle}</p>
            <p className="truncate font-serif text-base leading-snug text-foreground">{title}</p>
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      </div>
    </>
  )

  const baseClassName = cn("flex items-start gap-3 rounded-sm border border-border/70 bg-card/70 p-3", className)

  return (
    <div
      className={cn(baseClassName, onClick && "w-full cursor-pointer transition-colors hover:bg-accent/40")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      {content}
    </div>
  )
}

function SectionEmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-sm border border-dashed border-primary/30 bg-primary/5 p-3 text-xs text-[#7b6249]">
      {text}
    </div>
  )
}

function RelationPanel({
  title,
  count,
  icon,
  children,
}: {
  title: string
  count: number
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <section className="p-0">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/70 pb-2">
        <div className="flex items-center gap-2">
          <div className="text-muted-foreground">{icon}</div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</div>
        </div>
        <Badge variant="outline" className="h-5 px-1.5 py-0 text-[10px]">
          {count}
        </Badge>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

export function EstadoDetailDialog({
  estadoId,
  open,
  onOpenChange,
  onEstadoUpdated,
  onEstadoDeleted,
  onOpenEstado,
  onOpenCharacter,
  onOpenLandmark,
}: {
  estadoId?: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEstadoUpdated?: (estado: Estado) => void
  onEstadoDeleted?: (estadoId: number) => void
  onOpenEstado?: (estadoId: number) => void
  onOpenCharacter?: (characterId: number) => void
  onOpenLandmark?: (landmarkId: number) => void
}) {
  const [currentEstado, setCurrentEstado] = useState<Estado | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [formState, setFormState] = useState<EstadoFormState>(EMPTY_STATE)
  const [activePage, setActivePage] = useState("overview")

  const [characters, setCharacters] = useState<Character[]>([])
  const [landmarks, setLandmarks] = useState<Array<{ id: number; nombre: string }>>([])
  const [allEstados, setAllEstados] = useState<Estado[]>([])

  useEffect(() => {
    if (!open) {
      setCurrentEstado(null)
      setIsEditing(false)
      setSaveError(null)
      setActivePage("overview")
      setFormState(EMPTY_STATE)
      return
    }

    let isActive = true
    void fetchCharacters()
      .then((items) => {
        if (!isActive) return
        setCharacters(items)
      })
      .catch(() => {
        if (!isActive) return
        setCharacters([])
      })

    void fetchLandmarkReferences()
      .then((items) => {
        if (!isActive) return
        setLandmarks(items)
      })
      .catch(() => {
        if (!isActive) return
        setLandmarks([])
      })

    void fetchEstados(true)
      .then((items) => {
        if (!isActive) return
        setAllEstados(items)
      })
      .catch(() => {
        if (!isActive) return
        setAllEstados([])
      })

    if (typeof estadoId !== "number") {
      setCurrentEstado(null)
      setIsEditing(true)
      setSaveError(null)
      setActivePage("overview")
      setFormState(EMPTY_STATE)
      return () => {
        isActive = false
      }
    }

    void fetchEstadoById(estadoId)
      .then((estado) => {
        if (!isActive) return
        setCurrentEstado(estado)
        setFormState(toEstadoFormState(estado))
        setIsEditing(false)
        setSaveError(null)
        setActivePage("overview")
      })
      .catch(() => {
        if (!isActive) return
        setCurrentEstado(null)
        setFormState(EMPTY_STATE)
      })

    return () => {
      isActive = false
    }
  }, [estadoId, open])

  const previewNombre = isEditing ? formState.nombre.trim() || currentEstado?.nombre || "" : currentEstado?.nombre || formState.nombre
  const previewTipo = isEditing ? formState.tipo.trim() : currentEstado?.tipo ?? formState.tipo
  const previewGobierno = isEditing ? formState.gobiernoTipo.trim() : currentEstado?.gobiernoTipo ?? formState.gobiernoTipo

  const charactersById = new Map(characters.map((c) => [c.id, c]))
  const landmarkNameById = new Map(landmarks.map((l) => [l.id, l.nombre]))
  const subdivisionItems = currentEstado
    ? allEstados
        .filter((estado) => estado.estadoPadreId === currentEstado.id)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    : []
  const reloadEstadosIndex = async () => {
    try {
      const items = await fetchEstados(true)
      setAllEstados(items)
    } catch {
      setAllEstados([])
    }
  }

  const handleCreateSubdivision = async () => {
    if (!currentEstado || !isEditing) return

    const nextName = formState.subdivisionDraft.trim()
    if (!nextName) return

    try {
      const created = await createEstado({
        nombre: nextName,
        tipo: "Subdivision",
        descripcion: "",
        historia: "",
        gobiernoTipo: "",
        imagen: undefined,
        imagenAssetId: undefined,
        territorioImagen: undefined,
        territorioImagenAssetId: undefined,
        estadoPadreId: currentEstado.id,
        miembros: [],
        landmarks: [],
        subdivisiones: [],
      })

      setFormState((prev) => ({ ...prev, subdivisionDraft: "" }))
      setSaveError(null)
      await reloadEstadosIndex()
      onEstadoUpdated?.(created)
    } catch (error) {
      setSaveError(getBackendErrorMessage(error, "No se pudo crear la subdivision."))
    }
  }

  const handleStartEdit = () => {
    if (currentEstado) setFormState(toEstadoFormState(currentEstado))
    setIsEditing(true)
    setSaveError(null)
  }

  const handleCancelEdit = () => {
    if (!currentEstado) {
      onOpenChange(false)
      return
    }

    setFormState(toEstadoFormState(currentEstado))
    setIsEditing(false)
    setSaveError(null)
  }

  const handleSaveEdit = async () => {
    const nombre = formState.nombre.trim()
    const tipo = formState.tipo.trim()
    if (!nombre) {
      setSaveError("El nombre del estado es obligatorio.")
      return
    }
    if (!tipo) {
      setSaveError("El tipo del estado es obligatorio.")
      return
    }

    try {
      const payload = {
        nombre,
        tipo,
        gobiernoTipo: formState.gobiernoTipo.trim(),
        descripcion: formState.descripcion,
        historia: formState.historia,
        imagen: toOptionalText(formState.imagen),
        imagenAssetId: formState.imagenAssetId ?? undefined,
        territorioImagen: toOptionalText(formState.territorioImagen),
        territorioImagenAssetId: formState.territorioImagenAssetId ?? undefined,
        estadoPadreId: formState.estadoPadreId ?? undefined,
        miembros: formState.miembros.map((m) => ({ personajeId: m.personajeId, rol: normalizeRole(m.rol) })),
        landmarks: formState.landmarks.map((l) => ({ landmarkId: l.landmarkId, rol: normalizeRole(l.rol) })),
        subdivisiones: currentEstado?.subdivisiones ?? [],
      }

      const saved = currentEstado ? await updateEstado(currentEstado.id, payload) : await createEstado(payload)
      setCurrentEstado(saved)
      setFormState(toEstadoFormState(saved))
      setIsEditing(false)
      setSaveError(null)
      await reloadEstadosIndex()
      onEstadoUpdated?.(saved)
    } catch (error) {
      setSaveError(getBackendErrorMessage(error, "No se pudo guardar el estado."))
    }
  }

  const handleConfirmDelete = async () => {
    if (!currentEstado) return

    try {
      await deleteEstado(currentEstado.id)
      onEstadoDeleted?.(currentEstado.id)
      setIsDeleteDialogOpen(false)
      onOpenChange(false)
    } catch (error) {
      setSaveError(getBackendErrorMessage(error, "No se pudo eliminar el estado."))
    }
  }

  if (!open) return null

  const miembrosItems = isEditing ? formState.miembros : currentEstado?.miembros ?? []
  const landmarkRoleItems = isEditing ? formState.landmarks : currentEstado?.landmarks ?? []

  const descripcionSection = (
    <div>
      <div className="ornament-divider mb-3 text-xs font-serif">Descripcion</div>
      <MentionField
        source="auto"
        value={isEditing ? formState.descripcion : currentEstado?.descripcion ?? ""}
        onChange={isEditing ? (value) => setFormState((prev) => ({ ...prev, descripcion: value })) : undefined}
        editable={isEditing}
        rows={12}
        className="text-sm"
        placeholder="Descripcion del estado..."
        emptyText="Sin descripcion"
      />
    </div>
  )

  const territorioSection = (
    <div className="min-w-0 flex flex-col">
      <div className="mt-2 flex-1 overflow-x-auto">
        <ImageEmbeddingPicker
          usage="generic"
          value={isEditing ? toOptionalText(formState.territorioImagen) : currentEstado?.territorioImagen}
          assetId={formState.territorioImagenAssetId}
          onChange={(nextValue, nextAssetId) =>
            setFormState((prev) => ({
              ...prev,
              territorioImagen: nextValue,
              territorioImagenAssetId: nextAssetId,
            }))
          }
          label="Mapa / vista del mundo"
          previewMode="fitHeight"
          replaceOnClick={true}
          previewClassName="h-auto min-h-52"
          editable={isEditing}
          onRequestEdit={currentEstado ? handleStartEdit : undefined}
        />
      </div>
    </div>
  )

  const consejoSection = (
    <div className="min-w-0">
      <RelationPanel title="Miembros" count={miembrosItems.length} icon={<Users className="size-4" />}>
        {miembrosItems.map((m, index) => {
          const character = charactersById.get(m.personajeId)
          const name = character?.nombre ?? `Personaje #${m.personajeId}`
          const subtitle = m.rol?.trim() ? m.rol.trim() : "Cargo"

          return (
            <div key={`${m.personajeId}-${index}`} className="space-y-2">
              <CouncilCard
                className="w-full"
                title={name}
                subtitle={subtitle}
                image={character?.imagen ?? undefined}
                onClick={!isEditing && m.personajeId > 0 ? () => onOpenCharacter?.(m.personajeId) : undefined}
              />
              {isEditing ? (
                <>
                  <div className="grid grid-cols-[minmax(0,1fr)_2.25rem] gap-2">
                    <Select
                      value={String(m.personajeId)}
                      onValueChange={(value) =>
                        setFormState((prev) => ({
                          ...prev,
                          miembros: prev.miembros.map((item, idx) =>
                            idx === index ? { ...item, personajeId: Number(value) } : item,
                          ),
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 w-full text-xs">
                        <SelectValue placeholder="Personaje" />
                      </SelectTrigger>
                      <SelectContent>
                        {characters.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-0"
                      onClick={() =>
                        setFormState((prev) => ({
                          ...prev,
                          miembros: prev.miembros.filter((_item, idx) => idx !== index),
                        }))
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  <Input
                    value={m.rol}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        miembros: prev.miembros.map((item, idx) => (idx === index ? { ...item, rol: e.target.value } : item)),
                      }))
                    }
                    className="h-8 text-sm"
                    placeholder="Presidente, Archimago, Maestro de Espias..."
                  />
                </>
              ) : null}
            </div>
          )
        })}

        {miembrosItems.length === 0 ? <SectionEmptyState text="No hay miembros cargados." /> : null}

        {isEditing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={characters.length === 0}
            onClick={() => {
              const firstCharacterId = characters[0]?.id
              if (typeof firstCharacterId !== "number") return
              setFormState((prev) => ({
                ...prev,
                miembros: [...prev.miembros, { personajeId: firstCharacterId, rol: "" }],
              }))
            }}
          >
            <Plus className="size-4" />
            Nombrar consejero
          </Button>
        ) : null}
      </RelationPanel>
    </div>
  )

  const subdivisionesSection = (
    <div className="min-w-0">
      <RelationPanel title="Subdivisiones" count={subdivisionItems.length} icon={<GitBranch className="size-4" />}>
        {subdivisionItems.map((subdivision) => (
          <CouncilCard
            key={subdivision.id}
            className="w-full"
            title={subdivision.nombre}
            subtitle={subdivision.tipo || "Subdivision"}
            fallbackIcon={<MapPin className="size-6 text-primary/70 translate-y-[1px]" />}
            onClick={!isEditing ? () => onOpenEstado?.(subdivision.id) : undefined}
          />
        ))}

        {subdivisionItems.length === 0 ? <SectionEmptyState text="No hay subdivisiones para este estado." /> : null}

        {isEditing && currentEstado ? (
          <div className="flex items-center gap-2">
            <Input
              value={formState.subdivisionDraft}
              onChange={(e) => setFormState((prev) => ({ ...prev, subdivisionDraft: e.target.value }))}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return
                event.preventDefault()
                void handleCreateSubdivision()
              }}
              className="h-8 text-sm"
              placeholder="Provincia del Norte"
            />
              <Button
                type="button"
                size="sm"
                className="h-8"
                disabled={formState.subdivisionDraft.trim().length === 0}
                onClick={() => {
                  void handleCreateSubdivision()
                }}
              >
                <Plus className="size-4" />
              </Button>
          </div>
        ) : null}
      </RelationPanel>
    </div>
  )

  const landmarksSection = (
    <div className="min-w-0">
      <RelationPanel title="Landmarks" count={landmarkRoleItems.length} icon={<MapPinned className="size-4" />}>
        {landmarkRoleItems.map((l, index) => {
          const landmarkName = landmarkNameById.get(l.landmarkId) || `Landmark #${l.landmarkId}`
          const subtitle = l.rol?.trim() ? l.rol.trim() : "Rol"

          return (
            <div key={`${l.landmarkId}-${index}`} className="space-y-2">
              <CouncilCard
                className="w-full"
                title={landmarkName}
                subtitle={subtitle}
                fallbackIcon={<MapPin className="size-6 text-primary/70 translate-y-[1px]" />}
                onClick={!isEditing && l.landmarkId > 0 ? () => onOpenLandmark?.(l.landmarkId) : undefined}
              />
              {isEditing ? (
                <>
                  <div className="grid grid-cols-[minmax(0,1fr)_2.25rem] gap-2">
                    <Select
                      value={String(l.landmarkId)}
                      onValueChange={(value) =>
                        setFormState((prev) => ({
                          ...prev,
                          landmarks: prev.landmarks.map((item, idx) =>
                            idx === index ? { ...item, landmarkId: Number(value) } : item,
                          ),
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 w-full text-xs">
                        <SelectValue placeholder="Landmark" />
                      </SelectTrigger>
                      <SelectContent>
                        {landmarks.map((lm) => (
                          <SelectItem key={lm.id} value={String(lm.id)}>
                            {lm.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-0"
                      onClick={() =>
                        setFormState((prev) => ({
                          ...prev,
                          landmarks: prev.landmarks.filter((_item, idx) => idx !== index),
                        }))
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  <Input
                    value={l.rol}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        landmarks: prev.landmarks.map((item, idx) => (idx === index ? { ...item, rol: e.target.value } : item)),
                      }))
                    }
                    className="h-8 text-sm"
                    placeholder="Capital, Fortaleza, Puerto Real..."
                  />
                </>
              ) : null}
            </div>
          )
        })}

        {landmarkRoleItems.length === 0 ? <SectionEmptyState text="No hay landmarks vinculados." /> : null}

        {isEditing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={landmarks.length === 0}
            onClick={() => {
              const firstLandmarkId = landmarks[0]?.id
              if (typeof firstLandmarkId !== "number") return
              setFormState((prev) => ({
                ...prev,
                landmarks: [...prev.landmarks, { landmarkId: firstLandmarkId, rol: "" }],
              }))
            }}
          >
            <Plus className="size-4" />
            Marcar landmark
          </Button>
        ) : null}
      </RelationPanel>
    </div>
  )

  return (
    <>
      <DetailDialogShell open={open} onOpenChange={onOpenChange} contentClassName="parchment max-h-[90vh] w-[96vw] max-w-[92rem] overflow-hidden p-0">
          <div className="flex h-[85vh] flex-col">
            <div className="scroll-banner shrink-0">
              <DialogHeader>
                <div className="flex min-w-0 flex-col gap-3">
                  <div className="flex items-start gap-4">
                    <div className="w-32 shrink-0">
                      <ImageEmbeddingPicker
                        usage="generic"
                        value={isEditing ? toOptionalText(formState.imagen) : currentEstado?.imagen}
                        assetId={formState.imagenAssetId}
                        onChange={(nextValue, nextAssetId) =>
                          setFormState((prev) => ({ ...prev, imagen: nextValue, imagenAssetId: nextAssetId }))
                        }
                        label="Estandarte"
                        previewClassName="h-32 w-full"
                        editable={isEditing}
                        onRequestEdit={currentEstado ? handleStartEdit : undefined}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex size-10 items-center justify-center rounded-sm border-2 border-primary/30 bg-primary/10">
                          <Crown className="size-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex w-full items-start gap-2">
                            <div className="min-w-0 flex-1">
                              {isEditing ? (
                                <>
                                  <DialogTitle className="sr-only">{previewNombre}</DialogTitle>
                                  <Input
                                    value={formState.nombre}
                                    onChange={(e) => setFormState((prev) => ({ ...prev, nombre: e.target.value }))}
                                    className="h-10 border-primary/30 bg-card/80 font-serif text-xl"
                                    placeholder="Reino de Aster"
                                  />
                                </>
                              ) : (
                                <DialogTitle className="text-3xl font-serif text-primary truncate">{previewNombre}</DialogTitle>
                              )}
                            </div>

                            {!isEditing && currentEstado ? (
                              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                                <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={() => setIsDeleteDialogOpen(true)}>
                                  <Trash2 className="mr-1 size-3" />
                                  Eliminar
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleStartEdit}>
                                  <Pencil className="mr-1 size-3" />
                                  Editar
                                </Button>
                              </div>
                            ) : isEditing ? (
                              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                                <Button size="sm" className="h-7 px-2 text-xs" onClick={handleSaveEdit}>
                                  <Save className="mr-1 size-3" />
                                  Guardar
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleCancelEdit}>
                                  <X className="mr-1 size-3" />
                                  Cancelar
                                </Button>
                              </div>
                            ) : null}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="border-primary/30 text-[10px] text-primary">
                              {previewTipo || "(sin tipo)"}
                            </Badge>
                            {previewGobierno ? (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                                {previewGobierno}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <Input
                            value={formState.tipo}
                            onChange={(e) => setFormState((prev) => ({ ...prev, tipo: e.target.value }))}
                            className="h-8 text-sm"
                            placeholder="tipo (reino, imperio, pais...)"
                          />
                          <Input
                            value={formState.gobiernoTipo}
                            onChange={(e) => setFormState((prev) => ({ ...prev, gobiernoTipo: e.target.value }))}
                            className="h-8 text-sm"
                            placeholder="gobierno (monarquia, republica...)"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </DialogHeader>
            </div>

            <div className="min-h-0 flex-1">
              <Tabs value={activePage} onValueChange={setActivePage} className="flex h-full min-h-0 flex-col border-t border-border">
                <div className="px-6 pt-4">
                  <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="overview">Descripcion</TabsTrigger>
                    <TabsTrigger value="relations">Relaciones ({miembrosItems.length + subdivisionItems.length + landmarkRoleItems.length})</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="overview" className="mt-0 min-h-0 flex-1">
                  <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)]">
                    <ScrollArea className="min-h-0 border-r-0 lg:border-r lg:border-border">
                      <div className="flex flex-col gap-6 p-6">
                        {saveError ? <p className="text-xs text-destructive">{saveError}</p> : null}
                        {descripcionSection}
                      </div>
                    </ScrollArea>

                    <ScrollArea className="min-h-0 border-t border-border lg:border-t-0">
                      <div className="flex flex-col gap-6 p-6">{territorioSection}</div>
                    </ScrollArea>
                  </div>
                </TabsContent>

                <TabsContent value="relations" className="mt-0 min-h-0 flex-1">
                  <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-3">
                    <ScrollArea className="min-h-0 border-r-0 lg:border-r lg:border-border">
                      <div className="flex flex-col gap-6 p-6">{consejoSection}</div>
                    </ScrollArea>

                    <ScrollArea className="min-h-0 border-t border-border lg:border-t-0 lg:border-r lg:border-border">
                      <div className="flex flex-col gap-6 p-6">{subdivisionesSection}</div>
                    </ScrollArea>

                    <ScrollArea className="min-h-0 border-t border-border lg:border-t-0">
                      <div className="flex flex-col gap-6 p-6">{landmarksSection}</div>
                    </ScrollArea>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
      </DetailDialogShell>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Eliminar Estado"
        description="Landmarks apuntando a este estado quedaran con estado/subdivision en null."
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
