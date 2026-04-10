export type PartyInventoryItemKind = "catalog-item" | "custom-item"

export interface PartyInventoryBalance {
  copper: number
  silver: number
  gold: number
  platinum: number
  updatedAt?: string
}

export interface PartyInventoryItem {
  id: number
  kind: PartyInventoryItemKind
  name: string
  quantity: number
  carrierCharacterId?: number
  carriedBy?: string
  important: boolean
  notes?: string
  sourceItemName?: string
  sourceItemTypeCode?: string
  createdAt?: string
  updatedAt?: string
}

export interface PartyInventory {
  balance: PartyInventoryBalance
  items: PartyInventoryItem[]
}

export interface PartyInventoryBalanceInput {
  copper: number
  silver: number
  gold: number
  platinum: number
}

export interface PartyInventoryItemInput {
  kind: PartyInventoryItemKind
  name: string
  quantity: number
  carrierCharacterId?: number
  carriedBy?: string
  important: boolean
  notes?: string
  sourceItemName?: string
  sourceItemTypeCode?: string
}
