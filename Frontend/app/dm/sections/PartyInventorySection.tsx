"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { DmSectionMessage } from "@/components/dm/DmSectionMessage"
import { formatDmTimestamp } from "@/lib/dm/formatTimestamp"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ItemDetailDialog } from "@/components/dialog/detailed/ItemDetailDialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { buildItemItems } from "@/lib/informacion/items"
import { loadItems, type Item } from "@/lib/informacion/items/store"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import { fetchCharacters } from "@/lib/services/character-api.service"
import {
  createPartyInventoryItem,
  deletePartyInventoryItem,
  fetchPartyInventory,
  updatePartyInventoryBalance,
  updatePartyInventoryItem,
} from "@/lib/services/party-inventory-api.service"
import type { Character, PartyInventoryBalanceInput, PartyInventoryItem, PartyInventoryItemInput } from "@/lib/types"
import { Check, ChevronsUpDown, Pencil, Trash2, X } from "lucide-react"

type ItemFormState = {
  selectedCatalogId: string
  name: string
  quantity: string
  carrierCharacterId: number | null
  carriedBy: string
  important: boolean
  notes: string
  sourceItemName: string
  sourceItemTypeCode: string
}

const EMPTY_ITEM_FORM: ItemFormState = {
  selectedCatalogId: "",
  name: "",
  quantity: "1",
  carrierCharacterId: null,
  carriedBy: "",
  important: false,
  notes: "",
  sourceItemName: "",
  sourceItemTypeCode: "",
}

type CarrierComboboxProps = {
  characters: Character[]
  selectedCharacterId: number | null
  value: string
  onSelect: (character: Character) => void
  disabled?: boolean
}

type ItemNameAutocompleteProps = {
  items: Item[]
  value: string
  selectedId: string
  onValueChange: (value: string) => void
  onSelectItem: (item: Item, id: string) => void
  disabled?: boolean
}

type BalanceFormState = {
  copper: string
  silver: string
  gold: string
  platinum: string
}

type MoneyFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
}

function clampMoneyValue(rawValue: string) {
  if (rawValue === "") {
    return ""
  }

  return rawValue.replace(/[^0-9]/g, "")
}

function moneyToCopper(balance: PartyInventoryBalanceInput) {
  return balance.copper + balance.silver * 10 + balance.gold * 100 + balance.platinum * 1000
}

function formatCoinBreakdown(totalCopper: number) {
  let remaining = Math.max(0, Math.floor(totalCopper))
  const platinum = Math.floor(remaining / 1000)
  remaining -= platinum * 1000
  const gold = Math.floor(remaining / 100)
  remaining -= gold * 100
  const silver = Math.floor(remaining / 10)
  remaining -= silver * 10
  const copper = remaining
  return `${platinum} pp · ${gold} gp · ${silver} sp · ${copper} cp`
}

function buildItemPayload(form: ItemFormState): PartyInventoryItemInput {
  const quantity = Number.parseInt(form.quantity, 10)
  const isLinkedCatalogItem = Boolean(form.selectedCatalogId && form.sourceItemName)

  return {
    kind: isLinkedCatalogItem ? "catalog-item" : "custom-item",
    name: form.name.trim(),
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    carrierCharacterId: form.carrierCharacterId ?? undefined,
    carriedBy: form.carriedBy.trim(),
    important: form.important,
    notes: form.notes.trim(),
    sourceItemName: isLinkedCatalogItem ? form.sourceItemName.trim() : "",
    sourceItemTypeCode: isLinkedCatalogItem ? form.sourceItemTypeCode.trim() : "",
  }
}

function findLinkedCatalogItem(items: Item[], sourceItemName?: string, sourceItemTypeCode?: string) {
  if (!sourceItemName) {
    return null
  }

  return items.find((item) => item.name === sourceItemName && item.typeCode === (sourceItemTypeCode ?? "")) ?? null
}

function MoneyField({ label, value, onChange }: MoneyFieldProps) {
  return (
    <label className="space-y-1 text-sm font-medium text-foreground">
      {label}
      <Input value={value} onChange={(event) => onChange(clampMoneyValue(event.target.value))} inputMode="numeric" />
    </label>
  )
}

function CarrierCombobox({ characters, selectedCharacterId, value, onSelect, disabled = false }: CarrierComboboxProps) {
  const [open, setOpen] = useState(false)

  const selectedLabel = value.trim() || "Seleccionar personaje..."
  const sortedCharacters = useMemo(() => {
    return [...characters].sort((left, right) => {
      if (left.isPlayer !== right.isPlayer) {
        return left.isPlayer ? -1 : 1
      }
      return left.nombre.localeCompare(right.nombre, "es")
    })
  }, [characters])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="h-9 w-full justify-between overflow-hidden px-3 font-normal" disabled={disabled}>
          <span className="truncate text-left">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[22rem] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar personaje..." />
          <CommandList>
            <CommandEmpty>No hay coincidencias.</CommandEmpty>
            <CommandGroup heading="Personajes">
              {sortedCharacters.map((character) => {
                const isSelected = character.id === selectedCharacterId || (!selectedCharacterId && character.nombre === value)
                const subtitle = [character.isPlayer ? "Jugador" : "NPC", character.raza, character.clase].filter(Boolean).join(" · ")

                return (
                  <CommandItem
                    key={`carrier-${character.id}`}
                    value={`${character.nombre} ${subtitle}`}
                    onSelect={() => {
                      onSelect(character)
                      setOpen(false)
                    }}
                  >
                    <Check className={`size-4 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                    <div className="min-w-0">
                      <p className="truncate">{character.nombre}</p>
                      {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function ItemNameAutocomplete({ items, value, selectedId, onValueChange, onSelectItem, disabled = false }: ItemNameAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const itemOptions = useMemo(() => buildItemItems(items), [items])
  const normalizedValue = value.trim().toLocaleLowerCase("es")
  const filteredOptions = useMemo(() => {
    if (!normalizedValue) {
      return itemOptions.slice(0, 12)
    }
    return itemOptions.filter((itemOption) => itemOption.searchText.includes(normalizedValue)).slice(0, 12)
  }, [itemOptions, normalizedValue])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target || !containerRef.current?.contains(target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Veteran's Cane o Goblin corpse"
        disabled={disabled}
        autoComplete="off"
      />

      {isOpen && filteredOptions.length > 0 ? (
        <div className="absolute z-40 mt-1 max-h-80 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg">
          {filteredOptions.map((itemOption) => {
            const isSelected = itemOption.id === selectedId

            return (
              <button
                key={itemOption.id}
                type="button"
                className="flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  onSelectItem(itemOption.item, itemOption.id)
                  setIsOpen(false)
                }}
              >
                <Check className={`mt-0.5 size-4 shrink-0 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{itemOption.item.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {itemOption.item.typeLabel} · {itemOption.item.rarityLabel}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function PartyInventorySection() {
  const [catalogItems, setCatalogItems] = useState<Item[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [balanceForm, setBalanceForm] = useState<BalanceFormState>({
    copper: "0",
    silver: "0",
    gold: "0",
    platinum: "0",
  })
  const [items, setItems] = useState<PartyInventoryItem[]>([])
  const [search, setSearch] = useState("")
  const [showOnlyImportant, setShowOnlyImportant] = useState(false)
  const [itemForm, setItemForm] = useState<ItemFormState>(EMPTY_ITEM_FORM)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingBalance, setIsSavingBalance] = useState(false)
  const [isSavingItem, setIsSavingItem] = useState(false)
  const [isDeletingItem, setIsDeletingItem] = useState(false)
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [balanceMessage, setBalanceMessage] = useState<string | null>(null)
  const [itemError, setItemError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PartyInventoryItem | null>(null)
  const [dialogItem, setDialogItem] = useState<Item | null>(null)

  const catalogBrowserItems = useMemo(() => buildItemItems(catalogItems), [catalogItems])
  const charactersById = useMemo(() => new Map(characters.map((character) => [character.id, character])), [characters])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [inventory, nextCatalogItems, nextCharacters] = await Promise.all([
        fetchPartyInventory(),
        loadItems().catch(() => []),
        fetchCharacters().catch(() => []),
      ])
      setItems(inventory.items)
      setBalanceForm({
        copper: String(inventory.balance.copper),
        silver: String(inventory.balance.silver),
        gold: String(inventory.balance.gold),
        platinum: String(inventory.balance.platinum),
      })
      setCatalogItems(nextCatalogItems)
      setCharacters(nextCharacters)
    } catch (loadError) {
      setError(getBackendErrorMessage(loadError, "No se pudo cargar el inventario del party."))
      setItems([])
      setCatalogItems([])
      setCharacters([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const normalizedSearch = search.trim().toLocaleLowerCase("es")
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (showOnlyImportant && !item.important) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      const haystack = [item.name, item.carriedBy ?? "", item.important ? "importante recompensa" : "", item.notes ?? "", item.sourceItemName ?? "", item.sourceItemTypeCode ?? ""]
        .join(" ")
        .toLocaleLowerCase("es")

      return haystack.includes(normalizedSearch)
    })
  }, [items, normalizedSearch, showOnlyImportant])

  const totalCopper = useMemo(() => {
    return moneyToCopper({
      copper: Number.parseInt(balanceForm.copper, 10) || 0,
      silver: Number.parseInt(balanceForm.silver, 10) || 0,
      gold: Number.parseInt(balanceForm.gold, 10) || 0,
      platinum: Number.parseInt(balanceForm.platinum, 10) || 0,
    })
  }, [balanceForm])

  const resetItemForm = useCallback(() => {
    setItemForm(EMPTY_ITEM_FORM)
    setEditingItemId(null)
    setItemError(null)
  }, [])

  const handleSelectCatalogItem = useCallback((item: Item, id: string) => {
    setItemForm((current) => ({
      ...current,
      selectedCatalogId: id,
      name: item.name,
      sourceItemName: item.name,
      sourceItemTypeCode: item.typeCode,
    }))
  }, [])

  const handleItemNameChange = useCallback((nextValue: string) => {
    setItemForm((current) => {
      const keepsSelectedLink = current.selectedCatalogId.length > 0 && nextValue.trim() === current.sourceItemName
      return {
        ...current,
        name: nextValue,
        selectedCatalogId: keepsSelectedLink ? current.selectedCatalogId : "",
        sourceItemName: keepsSelectedLink ? current.sourceItemName : "",
        sourceItemTypeCode: keepsSelectedLink ? current.sourceItemTypeCode : "",
      }
    })
  }, [])

  const handleEditItem = useCallback((item: PartyInventoryItem) => {
    const matchedCatalogItem = findLinkedCatalogItem(catalogItems, item.sourceItemName, item.sourceItemTypeCode)
    const matchedCatalogId = matchedCatalogItem
      ? catalogBrowserItems.find((catalogItem) => catalogItem.item.name === matchedCatalogItem.name && catalogItem.item.typeCode === matchedCatalogItem.typeCode)?.id ?? ""
      : ""

    setEditingItemId(item.id)
    setItemForm({
      selectedCatalogId: matchedCatalogId,
      name: item.name,
      quantity: String(item.quantity),
      carrierCharacterId: item.carrierCharacterId ?? null,
      carriedBy: item.carriedBy ?? "",
      important: item.important,
      notes: item.notes ?? "",
      sourceItemName: item.sourceItemName ?? "",
      sourceItemTypeCode: item.sourceItemTypeCode ?? "",
    })
    setItemError(null)
  }, [catalogBrowserItems, catalogItems])

  const handleSaveBalance = useCallback(async () => {
    setIsSavingBalance(true)
    setBalanceMessage(null)
    setError(null)

    try {
      const nextBalance = {
        copper: Number.parseInt(balanceForm.copper, 10) || 0,
        silver: Number.parseInt(balanceForm.silver, 10) || 0,
        gold: Number.parseInt(balanceForm.gold, 10) || 0,
        platinum: Number.parseInt(balanceForm.platinum, 10) || 0,
      }
      const saved = await updatePartyInventoryBalance(nextBalance)
      setBalanceForm({
        copper: String(saved.copper),
        silver: String(saved.silver),
        gold: String(saved.gold),
        platinum: String(saved.platinum),
      })
      setBalanceMessage("Balance guardado.")
    } catch (saveError) {
      setError(getBackendErrorMessage(saveError, "No se pudo guardar el balance del party."))
    } finally {
      setIsSavingBalance(false)
    }
  }, [balanceForm])

  const handleSaveItem = useCallback(async () => {
    const payload = buildItemPayload(itemForm)
    if (!payload.name) {
      setItemError("El nombre del item es obligatorio.")
      return
    }

    setIsSavingItem(true)
    setItemError(null)
    setError(null)

    try {
      const savedItem = editingItemId === null
        ? await createPartyInventoryItem(payload)
        : await updatePartyInventoryItem(editingItemId, payload)

      setItems((current) => {
        if (editingItemId === null) {
          return [savedItem, ...current]
        }
        return current.map((item) => (item.id === savedItem.id ? savedItem : item))
      })
      resetItemForm()
    } catch (saveError) {
      setItemError(getBackendErrorMessage(saveError, "No se pudo guardar el item del inventario."))
    } finally {
      setIsSavingItem(false)
    }
  }, [editingItemId, itemForm, resetItemForm])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget || isDeletingItem) return

    setIsDeletingItem(true)
    setError(null)
    try {
      await deletePartyInventoryItem(deleteTarget.id)
      setItems((current) => current.filter((item) => item.id !== deleteTarget.id))
      if (editingItemId === deleteTarget.id) {
        resetItemForm()
      }
      setDeleteTarget(null)
    } catch (deleteError) {
      setError(getBackendErrorMessage(deleteError, "No se pudo eliminar el item del inventario."))
    } finally {
      setIsDeletingItem(false)
    }
  }, [deleteTarget, editingItemId, isDeletingItem, resetItemForm])

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-border bg-card p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl text-primary">Balance del party</h2>
            <p className="mt-1 text-sm text-muted-foreground">Dinero total compartido del grupo.</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>Total equivalente</p>
            <p className="font-medium text-foreground">{formatCoinBreakdown(totalCopper)}</p>
          </div>
        </div>

        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
        {balanceMessage ? <p className="mb-3 text-sm text-muted-foreground">{balanceMessage}</p> : null}

        <div className="grid gap-4 md:grid-cols-4">
          <MoneyField
            label="Cobre (cp)"
            value={balanceForm.copper}
            onChange={(value) => setBalanceForm((current) => ({ ...current, copper: value }))}
          />
          <MoneyField
            label="Plata (sp)"
            value={balanceForm.silver}
            onChange={(value) => setBalanceForm((current) => ({ ...current, silver: value }))}
          />
          <MoneyField
            label="Oro (gp)"
            value={balanceForm.gold}
            onChange={(value) => setBalanceForm((current) => ({ ...current, gold: value }))}
          />
          <MoneyField
            label="Platino (pp)"
            value={balanceForm.platinum}
            onChange={(value) => setBalanceForm((current) => ({ ...current, platinum: value }))}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <Button type="button" onClick={() => void handleSaveBalance()} disabled={isSavingBalance || isLoading}>
            {isSavingBalance ? "Guardando..." : "Guardar balance"}
          </Button>
        </div>
      </section>

      <section className="rounded-md border border-border bg-card p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl text-primary">Party Inventory</h2>
            <p className="mt-1 text-sm text-muted-foreground">Registra loot, items enlazados al catalogo y items manuales como monster corpses.</p>
          </div>
          {editingItemId !== null ? (
            <Button type="button" variant="outline" onClick={resetItemForm}>
              Cancelar edicion
            </Button>
          ) : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(320px,420px)_1fr]">
          <div className="space-y-4 rounded-md border border-border bg-background/60 p-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
              <label className="space-y-1 text-sm font-medium text-foreground">
                Nombre
                <ItemNameAutocomplete
                  items={catalogItems}
                  value={itemForm.name}
                  selectedId={itemForm.selectedCatalogId}
                  onValueChange={handleItemNameChange}
                  onSelectItem={handleSelectCatalogItem}
                  disabled={isSavingItem}
                />
                {itemForm.selectedCatalogId ? (
                  <p className="text-xs text-muted-foreground">
                    Enlazado a {itemForm.sourceItemName}{itemForm.sourceItemTypeCode ? ` (${itemForm.sourceItemTypeCode})` : ""}.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Si no elegis una opcion del dropdown, se guarda como item manual.</p>
                )}
              </label>

              <label className="space-y-1 text-sm font-medium text-foreground">
                Cantidad
                <Input value={itemForm.quantity} onChange={(event) => setItemForm((current) => ({ ...current, quantity: event.target.value.replace(/[^0-9]/g, "") }))} inputMode="numeric" disabled={isSavingItem} />
              </label>

              <label className="space-y-1 text-sm font-medium text-foreground">
                Quien lo lleva
                <div className="space-y-2">
                  <CarrierCombobox
                    characters={characters}
                    selectedCharacterId={itemForm.carrierCharacterId}
                    value={itemForm.carriedBy}
                    onSelect={(character) => setItemForm((current) => ({
                      ...current,
                      carrierCharacterId: character.id,
                      carriedBy: character.nombre,
                    }))}
                    disabled={isSavingItem || characters.length === 0}
                  />
                  {itemForm.carriedBy ? (
                    <div className="flex justify-end">
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setItemForm((current) => ({ ...current, carrierCharacterId: null, carriedBy: "" }))} disabled={isSavingItem}>
                        <X className="mr-1 size-3.5" /> Limpiar portador
                      </Button>
                    </div>
                  ) : null}
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground md:col-span-2 lg:col-span-1">
                <Checkbox checked={itemForm.important} onCheckedChange={(checked) => setItemForm((current) => ({ ...current, important: checked === true }))} disabled={isSavingItem} />
                <div>
                  <p>Marcar como importante</p>
                  <p className="text-xs font-normal text-muted-foreground">Para recompensas clave, loot memorable o compras que no queres perder de vista.</p>
                </div>
              </label>

              <label className="space-y-1 text-sm font-medium text-foreground md:col-span-2 lg:col-span-1">
                Notas
                <textarea
                  value={itemForm.notes}
                  onChange={(event) => setItemForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Estado, origen, partes utiles, etc."
                  className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={isSavingItem}
                />
              </label>
            </div>

            {itemError ? <p className="text-sm text-destructive">{itemError}</p> : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetItemForm} disabled={isSavingItem}>
                Limpiar
              </Button>
              <Button type="button" onClick={() => void handleSaveItem()} disabled={isSavingItem || isLoading}>
                {isSavingItem ? "Guardando..." : editingItemId === null ? "Agregar item" : "Guardar cambios"}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, portador o notas..." className="md:max-w-sm" />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={showOnlyImportant} onCheckedChange={(checked) => setShowOnlyImportant(checked === true)} />
                Solo importantes
              </label>
            </div>

            {isLoading ? (
              <DmSectionMessage>Cargando inventario...</DmSectionMessage>
            ) : filteredItems.length === 0 ? (
              <DmSectionMessage variant="empty">No hay items que coincidan con la busqueda.</DmSectionMessage>
            ) : (
              filteredItems.map((item) => {
                const timestamp = formatDmTimestamp(item.updatedAt ?? item.createdAt)
                const linkedCatalogItem = findLinkedCatalogItem(catalogItems, item.sourceItemName, item.sourceItemTypeCode)
                const linkedCarrier = item.carrierCharacterId ? charactersById.get(item.carrierCharacterId) : null
                const carrierLabel = linkedCarrier?.nombre ?? item.carriedBy

                return (
                  <article key={item.id} className="rounded-md border border-border bg-background p-4 shadow-sm">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {linkedCatalogItem ? (
                          <button type="button" className="truncate text-left font-serif text-lg text-primary hover:underline" onClick={() => setDialogItem(linkedCatalogItem)}>
                            {item.name}
                          </button>
                        ) : (
                          <h3 className="truncate font-serif text-lg text-primary">{item.name}</h3>
                        )}

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {item.important ? <Badge variant="secondary" className="text-[10px]">Importante</Badge> : null}
                          <span>Cantidad: {item.quantity}</span>
                          {carrierLabel ? <span>Lo lleva: {carrierLabel}</span> : null}
                          {timestamp ? <span>Actualizado: {timestamp}</span> : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button type="button" size="sm" variant="outline" className="h-8 px-2" onClick={() => handleEditItem(item)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button type="button" size="sm" variant="destructive" className="h-8 px-2" onClick={() => setDeleteTarget(item)} disabled={isDeletingItem}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    {linkedCatalogItem ? (
                      <p className="mb-2 text-xs text-muted-foreground">
                        Enlazado al catalogo: <button type="button" className="underline decoration-dotted underline-offset-2" onClick={() => setDialogItem(linkedCatalogItem)}>{linkedCatalogItem.name}</button>
                      </p>
                    ) : null}

                    {item.notes ? <p className="text-sm leading-relaxed text-foreground">{item.notes}</p> : null}
                  </article>
                )
              })
            )}
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Eliminar item"
        description={deleteTarget ? `Eliminar "${deleteTarget.name}" del inventario del party? Esta accion no se puede deshacer.` : "Esta accion no se puede deshacer."}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        confirmVariant="destructive"
        onConfirm={handleConfirmDelete}
      />
      <ItemDetailDialog item={dialogItem} open={dialogItem !== null} onOpenChange={(open) => { if (!open) setDialogItem(null) }} />
    </div>
  )
}
