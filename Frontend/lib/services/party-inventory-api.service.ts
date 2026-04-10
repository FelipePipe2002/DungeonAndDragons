import type {
  PartyInventory,
  PartyInventoryBalance,
  PartyInventoryBalanceInput,
  PartyInventoryItem,
  PartyInventoryItemInput,
  PartyInventoryItemKind,
} from "@/lib/types"
import { backendRequest } from "@/lib/services/backend-api.service"

type PartyInventoryBalanceDto = {
  copper?: number | null
  silver?: number | null
  gold?: number | null
  platinum?: number | null
  updatedAt?: string | null
}

type PartyInventoryItemDto = {
  id?: number | null
  kind?: string | null
  name?: string | null
  quantity?: number | null
  carrierCharacterId?: number | null
  carriedBy?: string | null
  important?: boolean | null
  notes?: string | null
  sourceItemName?: string | null
  sourceItemTypeCode?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

type PartyInventoryDto = {
  balance?: PartyInventoryBalanceDto | null
  items?: PartyInventoryItemDto[] | null
}

function normalizeKind(value: string | null | undefined): PartyInventoryItemKind {
  return value === "catalog-item" ? "catalog-item" : "custom-item"
}

function normalizeBalance(dto: PartyInventoryBalanceDto | null | undefined): PartyInventoryBalance {
  return {
    copper: typeof dto?.copper === "number" && Number.isFinite(dto.copper) ? dto.copper : 0,
    silver: typeof dto?.silver === "number" && Number.isFinite(dto.silver) ? dto.silver : 0,
    gold: typeof dto?.gold === "number" && Number.isFinite(dto.gold) ? dto.gold : 0,
    platinum: typeof dto?.platinum === "number" && Number.isFinite(dto.platinum) ? dto.platinum : 0,
    updatedAt: typeof dto?.updatedAt === "string" ? dto.updatedAt : undefined,
  }
}

function normalizeItem(dto: PartyInventoryItemDto): PartyInventoryItem | null {
  const id = typeof dto.id === "number" && Number.isFinite(dto.id) ? dto.id : 0
  const name = typeof dto.name === "string" ? dto.name.trim() : ""
  if (id <= 0 || !name) {
    return null
  }

  return {
    id,
    kind: normalizeKind(dto.kind),
    name,
    quantity: typeof dto.quantity === "number" && Number.isFinite(dto.quantity) && dto.quantity > 0 ? dto.quantity : 1,
    carrierCharacterId: typeof dto.carrierCharacterId === "number" && Number.isFinite(dto.carrierCharacterId) && dto.carrierCharacterId > 0 ? dto.carrierCharacterId : undefined,
    carriedBy: typeof dto.carriedBy === "string" && dto.carriedBy.trim().length > 0 ? dto.carriedBy : undefined,
    important: dto.important === true,
    notes: typeof dto.notes === "string" && dto.notes.trim().length > 0 ? dto.notes : undefined,
    sourceItemName: typeof dto.sourceItemName === "string" && dto.sourceItemName.trim().length > 0 ? dto.sourceItemName : undefined,
    sourceItemTypeCode: typeof dto.sourceItemTypeCode === "string" && dto.sourceItemTypeCode.trim().length > 0 ? dto.sourceItemTypeCode : undefined,
    createdAt: typeof dto.createdAt === "string" ? dto.createdAt : undefined,
    updatedAt: typeof dto.updatedAt === "string" ? dto.updatedAt : undefined,
  }
}

function normalizeInventory(dto: PartyInventoryDto | null | undefined): PartyInventory {
  return {
    balance: normalizeBalance(dto?.balance),
    items: Array.isArray(dto?.items) ? dto.items.map((item) => normalizeItem(item)).filter((item): item is PartyInventoryItem => item !== null) : [],
  }
}

function sanitizeItemInput(input: PartyInventoryItemInput) {
  return {
    kind: input.kind,
    name: input.name,
    quantity: input.quantity,
    carrierCharacterId: input.carrierCharacterId ?? null,
    carriedBy: input.carriedBy?.trim() || null,
    important: input.important,
    notes: input.notes?.trim() || null,
    sourceItemName: input.sourceItemName?.trim() || null,
    sourceItemTypeCode: input.sourceItemTypeCode?.trim() || null,
  }
}

export async function fetchPartyInventory(): Promise<PartyInventory> {
  const response = await backendRequest<PartyInventoryDto>("/v1/party-inventory")
  return normalizeInventory(response)
}

export async function updatePartyInventoryBalance(input: PartyInventoryBalanceInput): Promise<PartyInventoryBalance> {
  const response = await backendRequest<PartyInventoryBalanceDto>("/v1/party-inventory/balance", {
    method: "PUT",
    body: input,
  })
  return normalizeBalance(response)
}

export async function createPartyInventoryItem(input: PartyInventoryItemInput): Promise<PartyInventoryItem> {
  const response = await backendRequest<PartyInventoryItemDto>("/v1/party-inventory/items", {
    method: "POST",
    body: sanitizeItemInput(input),
  })
  const item = normalizeItem(response)
  if (!item) {
    throw new Error("Respuesta invalida al crear el item del inventario.")
  }
  return item
}

export async function updatePartyInventoryItem(itemId: number, input: PartyInventoryItemInput): Promise<PartyInventoryItem> {
  const response = await backendRequest<PartyInventoryItemDto>(`/v1/party-inventory/items/${itemId}`, {
    method: "PUT",
    body: sanitizeItemInput(input),
  })
  const item = normalizeItem(response)
  if (!item) {
    throw new Error("Respuesta invalida al actualizar el item del inventario.")
  }
  return item
}

export async function deletePartyInventoryItem(itemId: number): Promise<void> {
  await backendRequest<void>(`/v1/party-inventory/items/${itemId}`, {
    method: "DELETE",
  })
}
