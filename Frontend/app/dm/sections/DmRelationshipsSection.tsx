"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { DmSectionMessage } from "@/components/dm/DmSectionMessage"
import { formatDmTimestamp } from "@/lib/dm/formatTimestamp"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MentionField, buildMentionLookup } from "@/components/mentionField/MentionField"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { DmRelationship, DmRelationshipDirection, DmRelationshipEntityType } from "@/lib/types"
import { createDmRelationship, deleteDmRelationship, fetchDmRelationships, updateDmRelationship } from "@/lib/services/dm"
import { fetchRelationshipEntityOptions, type RelationshipEntityOption } from "@/lib/services/dm/entity-options"
import { DM_RELATIONSHIPS_CHANGED_EVENT, openCreateDmRelationshipDialog } from "@/lib/navigation/events"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import { Check, ChevronsUpDown, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

type RelationshipFormState = {
  leftEntity: string
  rightEntity: string
  direction: DmRelationshipDirection
  label: string
  notes: string
}

const ENTITY_TYPE_LABEL: Record<DmRelationshipEntityType, string> = {
  character: "Personaje",
  building: "Edificio",
  organization: "Organizacion",
  landmark: "Landmark",
}

const DIRECTION_LABEL: Record<DmRelationshipDirection, string> = {
  "left-to-right": "Izquierda -> Derecha",
  "right-to-left": "Izquierda <- Derecha",
  both: "Ambos sentidos",
}

const DIRECTION_ARROW: Record<DmRelationshipDirection, string> = {
  "left-to-right": "->",
  "right-to-left": "<-",
  both: "<->",
}

const EMPTY_FORM: RelationshipFormState = {
  leftEntity: "",
  rightEntity: "",
  direction: "left-to-right",
  label: "",
  notes: "",
}

const ENTITY_GROUP_ORDER: DmRelationshipEntityType[] = ["character", "building", "organization", "landmark"]
const DIRECTION_ORDER: DmRelationshipDirection[] = ["left-to-right", "right-to-left", "both"]

type RelationshipEntityComboboxProps = {
  value: string
  onChange: (value: string) => void
  optionsByType: Record<DmRelationshipEntityType, RelationshipEntityOption[]>
  disabled?: boolean
  placeholder: string
}

function RelationshipEntityCombobox({ value, onChange, optionsByType, disabled = false, placeholder }: RelationshipEntityComboboxProps) {
  const [open, setOpen] = useState(false)
  const selectedOption = useMemo(() => parseEntityValue(value), [value])
  const selectedOptionLabel = useMemo(() => {
    if (!selectedOption) return placeholder
    const option = optionsByType[selectedOption.type].find((candidate) => candidate.id === selectedOption.id)
    if (!option) return placeholder
    return option.subtitle ? `${option.label} (${option.subtitle})` : option.label
  }, [optionsByType, placeholder, selectedOption])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="h-9 w-full justify-between overflow-hidden px-3 font-normal" disabled={disabled}>
          <span className="truncate text-left">{selectedOptionLabel}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[20rem] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No hay coincidencias.</CommandEmpty>
            {ENTITY_GROUP_ORDER.map((groupKey) =>
              optionsByType[groupKey].length > 0 ? (
                <CommandGroup key={`relationship-group-${groupKey}`} heading={ENTITY_TYPE_LABEL[groupKey]}>
                  {optionsByType[groupKey].map((option) => {
                    const optionValue = encodeEntityValue(option.type, option.id)
                    const isSelected = optionValue === value
                    const searchValue = `${option.label} ${option.subtitle ?? ""} ${ENTITY_TYPE_LABEL[option.type]}`

                    return (
                      <CommandItem
                        key={`relationship-option-${option.type}-${option.id}`}
                        value={searchValue}
                        onSelect={() => {
                          onChange(optionValue)
                          setOpen(false)
                        }}
                      >
                        <Check className={cn("size-4", isSelected ? "opacity-100" : "opacity-0")} />
                        <div className="min-w-0">
                          <p className="truncate">{option.label}</p>
                          {option.subtitle ? <p className="truncate text-xs text-muted-foreground">{option.subtitle}</p> : null}
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ) : null,
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function encodeEntityValue(type: DmRelationshipEntityType, id: number) {
  return `${type}:${id}`
}

function parseEntityValue(value: string): { type: DmRelationshipEntityType; id: number } | null {
  const [rawType, rawId] = value.split(":")
  if (!rawType || !rawId) {
    return null
  }

  const id = Number.parseInt(rawId, 10)
  if (!Number.isFinite(id) || id <= 0) {
    return null
  }

  return {
    type: rawType as DmRelationshipEntityType,
    id,
  }
}

function buildRelationshipFormState(relationship: DmRelationship): RelationshipFormState {
  return {
    leftEntity: encodeEntityValue(relationship.leftEntityType, relationship.leftEntityId),
    rightEntity: encodeEntityValue(relationship.rightEntityType, relationship.rightEntityId),
    direction: relationship.direction,
    label: relationship.label,
    notes: relationship.notes ?? "",
  }
}

export function DmRelationshipsSection() {
  const [relationships, setRelationships] = useState<DmRelationship[]>([])
  const [entityOptions, setEntityOptions] = useState<RelationshipEntityOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [editingRelationshipId, setEditingRelationshipId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DmRelationship | null>(null)
  const [form, setForm] = useState<RelationshipFormState>(EMPTY_FORM)
  const [isFormOpen, setIsFormOpen] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [storedRelationships, nextOptions] = await Promise.all([
        fetchDmRelationships(),
        fetchRelationshipEntityOptions(),
      ])

      setRelationships(storedRelationships)
      setEntityOptions(nextOptions)
    } catch (loadError) {
      setError(getBackendErrorMessage(loadError, "No se pudieron cargar las relaciones del DM."))
      setRelationships([])
      setEntityOptions([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const handleRelationshipsChanged = () => {
      void loadData()
    }

    window.addEventListener(DM_RELATIONSHIPS_CHANGED_EVENT, handleRelationshipsChanged)
    return () => {
      window.removeEventListener(DM_RELATIONSHIPS_CHANGED_EVENT, handleRelationshipsChanged)
    }
  }, [loadData])

  const optionGroups = useMemo(() => {
    return {
      character: entityOptions.filter((item) => item.type === "character"),
      building: entityOptions.filter((item) => item.type === "building"),
      organization: entityOptions.filter((item) => item.type === "organization"),
      landmark: entityOptions.filter((item) => item.type === "landmark"),
    }
  }, [entityOptions])

  const mentionEntities = useMemo(
    () => entityOptions.map((item) => ({ type: item.type, id: item.id, label: item.label, subtitle: item.subtitle })),
    [entityOptions],
  )

  const mentionLookup = useMemo(() => buildMentionLookup(mentionEntities), [mentionEntities])

  const entityOptionByValue = useMemo(
    () => new Map(entityOptions.map((option) => [encodeEntityValue(option.type, option.id), option] as const)),
    [entityOptions],
  )

  const resetForm = useCallback(() => {
    setForm({ ...EMPTY_FORM })
    setFormError(null)
    setEditingRelationshipId(null)
    setIsFormOpen(false)
  }, [])

  const handleSubmit = useCallback(async () => {
    const left = parseEntityValue(form.leftEntity)
    const right = parseEntityValue(form.rightEntity)
    const label = form.label.trim()

    if (!left || !right) {
      setFormError("Selecciona ambas entidades de la relacion.")
      return
    }

    if (!label) {
      setFormError("La etiqueta de la relacion es obligatoria.")
      return
    }

    setIsSaving(true)
    setFormError(null)

    try {
      const payload = {
        leftEntityType: left.type,
        leftEntityId: left.id,
        rightEntityType: right.type,
        rightEntityId: right.id,
        direction: form.direction,
        label,
        notes: form.notes,
      }

      const savedRelationship =
        editingRelationshipId === null
          ? await createDmRelationship(payload)
          : await updateDmRelationship(editingRelationshipId, payload)

      setRelationships((current) => {
        if (editingRelationshipId === null) {
          return [savedRelationship, ...current]
        }

        return current.map((relationship) => (relationship.id === savedRelationship.id ? savedRelationship : relationship))
      })
      resetForm()
    } catch (saveError) {
      setFormError(getBackendErrorMessage(saveError, "No se pudo guardar la relacion."))
    } finally {
      setIsSaving(false)
    }
  }, [editingRelationshipId, form, resetForm])

  const handleEdit = useCallback((relationship: DmRelationship) => {
    setEditingRelationshipId(relationship.id)
    setForm(buildRelationshipFormState(relationship))
    setFormError(null)
    setIsFormOpen(true)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget || isDeleting) return

    setIsDeleting(true)
    try {
      await deleteDmRelationship(deleteTarget.id)
      setRelationships((current) => current.filter((relationship) => relationship.id !== deleteTarget.id))
      if (editingRelationshipId === deleteTarget.id) {
        resetForm()
      }
      setDeleteTarget(null)
    } catch (deleteError) {
      setError(getBackendErrorMessage(deleteError, "No se pudo eliminar la relacion."))
    } finally {
      setIsDeleting(false)
    }
  }, [deleteTarget, editingRelationshipId, isDeleting, resetForm])

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-border bg-card p-4 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl text-primary">Relaciones</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Registra vinculos entre personajes, edificios, organizaciones y landmarks.
            </p>
          </div>
          <Button type="button" onClick={openCreateDmRelationshipDialog}>
            Agregar relacion
          </Button>
        </div>

        {isFormOpen ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {editingRelationshipId !== null ? (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar edicion
                </Button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-foreground">
                Entidad izquierda
                <RelationshipEntityCombobox
                  value={form.leftEntity}
                  onChange={(nextValue) => setForm((current) => ({ ...current, leftEntity: nextValue }))}
                  optionsByType={optionGroups}
                  disabled={isSaving || entityOptions.length === 0}
                  placeholder="Buscar entidad izquierda..."
                />
              </label>

              <label className="space-y-1 text-sm font-medium text-foreground">
                Entidad derecha
                <RelationshipEntityCombobox
                  value={form.rightEntity}
                  onChange={(nextValue) => setForm((current) => ({ ...current, rightEntity: nextValue }))}
                  optionsByType={optionGroups}
                  disabled={isSaving || entityOptions.length === 0}
                  placeholder="Buscar entidad derecha..."
                />
              </label>

              <label className="space-y-1 text-sm font-medium text-foreground">
                Direccion
                <select
                  className="border-input bg-background h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                  value={form.direction}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, direction: event.target.value as DmRelationshipDirection }))
                  }
                  disabled={isSaving}
                >
                  {DIRECTION_ORDER.map((direction) => (
                    <option key={`direction-${direction}`} value={direction}>
                      {DIRECTION_LABEL[direction]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm font-medium text-foreground">
                Etiqueta de la flecha
                <Input
                  value={form.label}
                  onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                  placeholder="Ej: Friend, Destroyed, Member of"
                  disabled={isSaving}
                />
              </label>

            </div>

            <label className="mt-4 block space-y-1 text-sm font-medium text-foreground">
              Notas
              <MentionField
                value={form.notes}
                entities={mentionEntities}
                mentionLookup={mentionLookup}
                mentionFormat="token"
                rows={4}
                onChange={(nextValue) => setForm((current) => ({ ...current, notes: nextValue }))}
                placeholder="Contexto adicional de la relacion. Usa @ para mencionar entidades"
                className="min-h-24"
                disabled={isSaving}
              />
            </label>

            {formError ? <p className="mt-3 text-sm text-destructive">{formError}</p> : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button type="button" onClick={handleSubmit} disabled={isSaving || entityOptions.length === 0}>
                {isSaving ? "Guardando..." : editingRelationshipId === null ? "Agregar relacion" : "Guardar cambios"}
              </Button>
              {editingRelationshipId !== null ? (
                <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving}>
                  Limpiar formulario
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </section>

      <section className="space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {isLoading ? (
          <DmSectionMessage>Cargando relaciones...</DmSectionMessage>
        ) : relationships.length === 0 ? (
          <DmSectionMessage variant="empty">No hay relaciones guardadas todavia.</DmSectionMessage>
        ) : (
          relationships.map((relationship) => {
            const left = entityOptionByValue.get(encodeEntityValue(relationship.leftEntityType, relationship.leftEntityId))
            const right = entityOptionByValue.get(encodeEntityValue(relationship.rightEntityType, relationship.rightEntityId))
            const updatedAt = formatDmTimestamp(relationship.updatedAt ?? relationship.createdAt)

            return (
              <article key={relationship.id} className="rounded-md border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                      <Badge variant="outline">{ENTITY_TYPE_LABEL[relationship.leftEntityType]}</Badge>
                      <span className="font-semibold">{left?.label ?? `#${relationship.leftEntityId}`}</span>
                      <span className="text-muted-foreground">{DIRECTION_ARROW[relationship.direction]}</span>
                      <Badge variant="secondary">{relationship.label}</Badge>
                      <span className="font-semibold">{right?.label ?? `#${relationship.rightEntityId}`}</span>
                      <Badge variant="outline">{ENTITY_TYPE_LABEL[relationship.rightEntityType]}</Badge>
                    </div>

                    {(left?.subtitle || right?.subtitle) ? (
                      <p className="text-xs text-muted-foreground">
                        {[left?.subtitle, right?.subtitle].filter(Boolean).join(" • ")}
                      </p>
                    ) : null}

                    {relationship.notes ? (
                      <MentionField
                        value={relationship.notes}
                        entities={mentionEntities}
                        mentionLookup={mentionLookup}
                        editable={false}
                        emptyText=""
                        className="text-sm leading-relaxed text-foreground/90"
                      />
                    ) : null}

                    {updatedAt ? <p className="text-xs text-muted-foreground">Actualizado {updatedAt}</p> : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => handleEdit(relationship)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => setDeleteTarget(relationship)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </article>
            )
          })
        )}
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTarget(null)
          }
        }}
        title="Eliminar relacion"
        description={deleteTarget ? `Eliminar la relacion "${deleteTarget.label}"? Esta accion no se puede deshacer.` : ""}
        confirmLabel={isDeleting ? "Eliminando..." : "Eliminar"}
        confirmVariant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
