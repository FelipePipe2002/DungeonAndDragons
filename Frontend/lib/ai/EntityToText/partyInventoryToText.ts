import { UNKNOWN_LABEL } from "@/lib/display"
import type { PartyInventory, PartyInventoryItem } from "@/lib/types"
import { fetchCharacters } from "@/lib/services/character-api.service"

const DEFAULT_LIST_LIMIT = 25

function toOptionalTrimmedText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function formatMissing(label: string) {
  return `${label}: No tiene esta informacion`
}

function formatCappedSection(header: string, lines: string[], totalCount: number, limit = DEFAULT_LIST_LIMIT) {
  if (totalCount <= 0) {
    return [formatMissing(header)]
  }
  const result: string[] = [header + ":", ...lines.slice(0, limit)]
  const remaining = totalCount - Math.min(totalCount, limit)
  if (remaining > 0) {
    result.push(`... y ${remaining} mas`)
  }
  return result
}

function formatBalance(inv: PartyInventory) {
  const b = inv.balance
  return `Balance: ${b.platinum} platino, ${b.gold} oro, ${b.silver} plata, ${b.copper} cobre`
}

function compareItems(a: PartyInventoryItem, b: PartyInventoryItem) {
  if (a.important !== b.important) {
    return a.important ? -1 : 1
  }
  return a.name.localeCompare(b.name, "es")
}

function itemToLine(item: PartyInventoryItem, characterNameById: Map<number, string>) {
  const parts: string[] = [`- ${item.name} x${item.quantity} (id: ${item.id})`]

  if (item.important) {
    parts.push("Importante: si")
  }

  if (typeof item.carrierCharacterId === "number" && item.carrierCharacterId > 0) {
    const fallback = toOptionalTrimmedText(item.carriedBy) ?? UNKNOWN_LABEL
    const carrierName = characterNameById.get(item.carrierCharacterId) ?? fallback
    parts.push(`Portador: ${carrierName} (id: ${item.carrierCharacterId})`)
  } else {
    const carriedBy = toOptionalTrimmedText(item.carriedBy)
    if (carriedBy) {
      parts.push(`Llevado por: ${carriedBy}`)
    }
  }

  const sourceName = toOptionalTrimmedText(item.sourceItemName)
  const sourceType = toOptionalTrimmedText(item.sourceItemTypeCode)
  if (sourceName && sourceType) {
    parts.push(`Fuente: ${sourceName} (${sourceType})`)
  } else if (sourceName) {
    parts.push(`Fuente: ${sourceName}`)
  } else if (sourceType) {
    parts.push(`Fuente: ${sourceType}`)
  }

  const notes = toOptionalTrimmedText(item.notes)
  if (notes) {
    parts.push(`Notas: ${notes}`)
  }

  return parts.join(" | ")
}

// Formats a PartyInventory into a lore-focused text block for AI consumption.
// Notes:
// - Resolves carrierCharacterId to character name while keeping the id.
// - Caps item list to avoid overwhelming the prompt.
export async function partyInventoryToText(inventory: PartyInventory): Promise<string> {
  const lines: string[] = []
  lines.push("Inventario del grupo")
  lines.push(formatBalance(inventory))

  const updatedAt = toOptionalTrimmedText(inventory.balance.updatedAt)
  if (updatedAt) {
    lines.push(`Actualizado: ${updatedAt}`)
  }

  const items = Array.isArray(inventory.items) ? [...inventory.items] : []
  items.sort(compareItems)

  const carrierIds = new Set<number>()
  for (const item of items) {
    if (typeof item.carrierCharacterId === "number" && item.carrierCharacterId > 0) {
      carrierIds.add(item.carrierCharacterId)
    }
  }

  const characterNameById = new Map<number, string>()
  if (carrierIds.size > 0) {
    const characters = await fetchCharacters().catch(() => [])
    for (const character of characters) {
      if (!carrierIds.has(character.id)) continue
      const name = toOptionalTrimmedText(character.nombre)
      if (name) {
        characterNameById.set(character.id, name)
      }
    }
  }

  const itemLines = items.map((item) => itemToLine(item, characterNameById))
  lines.push(...formatCappedSection("Items", itemLines, items.length))

  return lines.join("\n")
}
