"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"

import { MentionField, buildMentionLookup } from "@/components/mentionField/MentionField"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { DmRelationshipDirection, DmRelationshipEntityType, DmRelationshipInput } from "@/lib/types"
import { fetchRelationshipEntityOptions, type RelationshipEntityOption } from "@/lib/dm-relationships/entity-options"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

type CreateDmRelationshipDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateRelationship: (relationship: DmRelationshipInput) => boolean | void | Promise<boolean | void>
}

type RelationshipFormState = {
  leftEntity: string
  rightEntity: string
  direction: DmRelationshipDirection
  label: string
  notes: string
}

const EMPTY_FORM: RelationshipFormState = {
  leftEntity: "",
  rightEntity: "",
  direction: "left-to-right",
  label: "",
  notes: "",
}

const ENTITY_TYPE_LABEL: Record<DmRelationshipEntityType, string> = {
  character: "Personaje",
  building: "Edificio",
  organization: "Organizacion",
  landmark: "Landmark",
}

const ENTITY_GROUP_ORDER: DmRelationshipEntityType[] = ["character", "building", "organization", "landmark"]
const DIRECTION_ORDER: DmRelationshipDirection[] = ["left-to-right", "right-to-left", "both"]

const DIRECTION_LABEL: Record<DmRelationshipDirection, string> = {
  "left-to-right": "Izquierda -> Derecha",
  "right-to-left": "Izquierda <- Derecha",
  both: "Ambos sentidos",
}

type RelationshipEntityComboboxProps = {
  value: string
  onChange: (value: string) => void
  optionsByType: Record<DmRelationshipEntityType, RelationshipEntityOption[]>
  disabled?: boolean
  placeholder: string
}

function encodeEntityValue(type: DmRelationshipEntityType, id: number) {
  return `${type}:${id}`
}

function parseEntityValue(value: string): { type: DmRelationshipEntityType; id: number } | null {
  const [rawType, rawId] = value.split(":")
  if (!rawType || !rawId) return null

  const id = Number.parseInt(rawId, 10)
  if (!Number.isFinite(id) || id <= 0) return null

  return { type: rawType as DmRelationshipEntityType, id }
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

export function CreateDmRelationshipDialog({ open, onOpenChange, onCreateRelationship }: CreateDmRelationshipDialogProps) {
  const [entityOptions, setEntityOptions] = useState<RelationshipEntityOption[]>([])
  const [isLoadingEntities, setIsLoadingEntities] = useState(false)
  const [form, setForm] = useState<RelationshipFormState>(EMPTY_FORM)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return

    setForm(EMPTY_FORM)
    setSaveError(null)
    setIsSaving(false)
  }, [open])

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setIsLoadingEntities(true)
    void fetchRelationshipEntityOptions()
      .then((options) => {
        if (!cancelled) {
          setEntityOptions(options)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setEntityOptions([])
          setSaveError(getBackendErrorMessage(error, "No se pudieron cargar las entidades para relaciones."))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingEntities(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open])

  const optionGroups = useMemo(() => ({
    character: entityOptions.filter((item) => item.type === "character"),
    building: entityOptions.filter((item) => item.type === "building"),
    organization: entityOptions.filter((item) => item.type === "organization"),
    landmark: entityOptions.filter((item) => item.type === "landmark"),
  }), [entityOptions])

  const mentionEntities = useMemo(
    () => entityOptions.map((item) => ({ type: item.type, id: item.id, label: item.label, subtitle: item.subtitle })),
    [entityOptions],
  )

  const mentionLookup = useMemo(() => buildMentionLookup(mentionEntities), [mentionEntities])

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const left = parseEntityValue(form.leftEntity)
    const right = parseEntityValue(form.rightEntity)
    const label = form.label.trim()

    if (!left || !right) {
      setSaveError("Selecciona ambas entidades de la relacion.")
      return
    }

    if (!label) {
      setSaveError("La etiqueta de la relacion es obligatoria.")
      return
    }

    setIsSaving(true)
    setSaveError(null)
    let saved: boolean | void = undefined
    try {
      saved = await onCreateRelationship({
        leftEntityType: left.type,
        leftEntityId: left.id,
        rightEntityType: right.type,
        rightEntityId: right.id,
        direction: form.direction,
        label,
        notes: form.notes,
      })
    } finally {
      setIsSaving(false)
    }

    if (saved === false) return
    onOpenChange(false)
  }, [form, onCreateRelationship, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="parchment max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-primary">Nueva relacion</DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {saveError ? <p className="text-xs text-destructive">{saveError}</p> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-foreground">
              Entidad izquierda
              <RelationshipEntityCombobox
                value={form.leftEntity}
                onChange={(nextValue) => setForm((current) => ({ ...current, leftEntity: nextValue }))}
                optionsByType={optionGroups}
                disabled={isSaving || isLoadingEntities || entityOptions.length === 0}
                placeholder="Buscar entidad izquierda..."
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-foreground">
              Entidad derecha
              <RelationshipEntityCombobox
                value={form.rightEntity}
                onChange={(nextValue) => setForm((current) => ({ ...current, rightEntity: nextValue }))}
                optionsByType={optionGroups}
                disabled={isSaving || isLoadingEntities || entityOptions.length === 0}
                placeholder="Buscar entidad derecha..."
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-foreground">
              Direccion
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                value={form.direction}
                onChange={(event) => setForm((current) => ({ ...current, direction: event.target.value as DmRelationshipDirection }))}
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

          <label className="block space-y-1 text-sm font-medium text-foreground">
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

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isSaving || isLoadingEntities || entityOptions.length === 0}>
              {isSaving ? "Guardando..." : "Agregar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
